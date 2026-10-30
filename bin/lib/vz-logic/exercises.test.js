"use strict";

/* global describe, it, beforeEach, afterEach */
const { expect } = require("chai");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yaml = require("js-yaml");
const { generate } = require("./exercises");
const collection = require("../exercise-collection")("logic");

describe("logic exercise collections", () => {
  let directory, input, output, manifest, doc;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "vzpac-logic-"));
    input = path.join(directory, "logic.yml");
    output = path.join(directory, "generated", "chapter.md");
    manifest = path.join(directory, "figure's $(touch injected)", "assets.yml");
    fs.writeFileSync(path.join(directory, "chapter.md"), "# Logic\n\n${example.exercise}\n");
    fs.writeFileSync(path.join(directory, "family.md"), ["---", "intro: '${variableCount} inputs'", "---",
      "${intro}: $${originalLatex}$", "${truthTable}", "${costTable}",
      "![simple](${netlist1Assets}.svg)", "![aig](${netlist2Assets}.svg)", "[edit](${source})"].join("\n"));
    doc = { mode: "inline", chapter: "chapter.md", template: "family.md", tag: "logic", sections: [{ title: "Logic", exercises: [
      { id: "example", generate: { variables: ["a", "b"], expressions: { original: "a & b" }, costs: ["original"], netlists: [
        { id: "diagram-one", mode: "simple", outputs: { f: "original" } },
        { id: "diagram-two", mode: "aig", outputs: { f: "original" } }
      ] } }
    ] }] };
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  function run() {
    fs.writeFileSync(input, yaml.dump(doc));
    generate(input, output, manifest);
    return fs.readFileSync(output, "utf8");
  }
  function beforeFiles() { return [output, manifest].map(filename => fs.readFileSync(filename, "utf8")); }

  it("resolves multiple diagram links relative to the chapter, including encoded shell metacharacters", () => {
    const markdown = run();
    const destinations = [...markdown.matchAll(/!\[[^\]]+\]\(([^)]+)\)/g)].map(match => path.resolve(path.dirname(output), decodeURIComponent(match[1])));
    expect(destinations).to.deep.equal([
      path.join(path.dirname(manifest), "diagram-one", "assets", "diagram-one.svg"),
      path.join(path.dirname(manifest), "diagram-two", "assets", "diagram-two.svg")
    ]);
    const edit = markdown.match(/\[edit\]\(([^)]+)\)/)[1];
    expect(path.resolve(path.dirname(output), decodeURIComponent(edit))).to.equal(input);
    expect(fs.existsSync(path.join(directory, "injected"))).to.equal(false);
  });

  it("updates the mathematical question, rows and gate costs when parameters change", () => {
    const first = run();
    expect(first).to.include("2 inputs").and.include("| 1 | 0 | 0 |");
    const options = doc.sections[0].exercises[0].generate;
    options.variables = ["a", "b", "c"];
    options.expressions.original = "a | b | c";
    const second = run();
    expect(second).to.include("3 inputs").and.include("| 1 | 0 | 0 | 1 |");
    const costRows = second.split("\n").filter(line => /^\| (cardinalità|letterali|numero di input)/.test(line));
    expect(costRows).to.deep.equal(["| cardinalità | 1 |", "| letterali | 3 |", "| numero di input | 3 |"]);
  });

  it("keeps unchanged output mtimes stable for incremental builds", () => {
    run();
    const fixed = new Date("2001-01-01T00:00:00Z");
    [output, manifest].forEach(filename => fs.utimesSync(filename, fixed, fixed));
    run();
    expect([output, manifest].map(filename => fs.statSync(filename).mtimeMs)).to.deep.equal([fixed.getTime(), fixed.getTime()]);
  });

  it("supports an explicit asset-only instance without manufacturing an exercise solution", () => {
    fs.appendFileSync(path.join(directory, "chapter.md"), "\n${bus.assets}\n");
    doc.sections[0].exercises.push({ id: "bus", template: null, generate: { variables: ["a0", "a1", "b0", "b1", "s"], expressions: {
      f0: "a0 & ~s | b0 & s", f1: "a1 & ~s | b1 & s"
    }, netlists: [{ id: "bus", mode: "simple", outputs: { f0: "f0", f1: "f1" } }] } });
    const markdown = run();
    expect(markdown).not.to.include("f0").and.not.to.include("f1");
    const basename = decodeURIComponent(markdown.trim().split("\n").pop());
    expect(path.resolve(path.dirname(output), basename)).to.equal(path.join(path.dirname(manifest), "bus", "assets", "bus"));
  });

  for (const [label, change, error] of [
    ["a bad later expression", value => value.sections[0].exercises.push({ id: "later", generate: { variables: ["a"], expressions: { f: "unknown" } } }), /unknown variable/],
    ["a diagram reused by another exercise", value => value.sections[0].exercises.push({ id: "later", generate: value.sections[0].exercises[0].generate }), /collides/],
    ["an exercise colliding with an earlier extra diagram", value => value.sections[0].exercises.push({ id: "diagram-one", generate: { variables: [], expressions: { f: "1" } } }), /collides/],
    ["an extra diagram colliding with a later exercise", value => { value.sections[0].exercises[0].generate.netlists[0].id = "later"; value.sections[0].exercises.push({ id: "later", generate: { variables: [], expressions: { f: "1" } } }); }, /collides/],
    ["a duplicate diagram", value => value.sections[0].exercises[0].generate.netlists.push({ id: "diagram-one", mode: "aig", outputs: { f: "original" } }), /duplicate netlist/],
    ["a base-manifest collision", value => { fs.writeFileSync(path.join(directory, "base.yml"), "diagram-one: {manual: true}\n"); value.base_assets = "base.yml"; }, /collides/],
    ["an unsafe diagram", value => { value.sections[0].exercises[0].generate.netlists[0].id = "../escape"; }, /safe asset basename/],
    ["ambiguous positional diagram names", value => { value.sections[0].exercises[0].generate.netlists[0].id = "netlist2"; }, /collision/],
    ["a failed equivalence check", value => { const options = value.sections[0].exercises[0].generate; options.expressions.bad = "a | b"; options.checks = [["original", "bad"]]; }, /differ for/],
    ["an unknown family placeholder", () => fs.appendFileSync(path.join(directory, "family.md"), "\n${missing}"), /unknown placeholder/],
    ["unreferenced data", value => value.sections[0].exercises.push({ id: "unreferenced", template: null, generate: { kind: "prose", parameters: { width: 4 } } }), /unreferenced/]
  ]) it(`rejects ${label} before replacing either output`, () => {
    run();
    const previous = beforeFiles();
    change(doc);
    expect(run).to.throw(error);
    expect(beforeFiles()).to.deep.equal(previous);
  });

  it("rejects a generated asset directory containing a chapter output before writing files", () => {
    run();
    const previous = beforeFiles();
    const originalOutput = output;
    output = path.join(path.dirname(manifest), "diagram-one", "chapter.md");
    expect(run).to.throw(/must not contain/);
    expect(fs.existsSync(output)).to.equal(false);
    output = originalOutput;
    expect(beforeFiles()).to.deep.equal(previous);
  });

  it("rejects generated extra entries overlapping base directories reached through symlinks", () => {
    run();
    const previous = beforeFiles();
    const target = path.join(path.dirname(manifest), "diagram-one");
    fs.mkdirSync(target, { recursive: true });
    fs.symlinkSync(target, path.join(directory, "alias"));
    fs.writeFileSync(path.join(directory, "base.yml"), "alias: {manual: true}\n");
    doc.base_assets = "base.yml";
    expect(run).to.throw(/collides/);
    expect(beforeFiles()).to.deep.equal(previous);
  });

  for (const [label, entries] of [
    ["parent traversal", { "../escape": { manual: true } }],
    ["absolute path", { "/tmp/escape": { manual: true } }],
    ["primary ID collision", { example: { manual: true } }],
    ["nonmapping entries", []],
    ["nonmapping entry", { extra: null }],
    ["input parent traversal", { extra: { inputs: { "../chapter.md": "overwrite" } } }],
    ["input absolute path", { extra: { inputs: { "/tmp/escape": "overwrite" } } }],
    ["nonmapping inputs", { extra: { inputs: [] } }]
  ]) it(`validates generic generated.entries ${label} before either output`, () => {
    run();
    const previous = beforeFiles();
    expect(() => collection.generate(input, output, manifest, () => ({ entry: { manual: true }, values: {}, entries }))).to.throw();
    expect(beforeFiles()).to.deep.equal(previous);
  });
});
