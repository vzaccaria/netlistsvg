"use strict";

/* global describe, it, beforeEach, afterEach */
const { expect } = require("chai");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yaml = require("js-yaml");
const { generate } = require("./exercises");

const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
const program = [{ op: "lw", d: 1, s1: 10 }, { op: "sub", d: 2, s1: 1, s2: 12 }];

describe("inline pipeline exercise collection", function () {
  this.timeout(60000);
  let directory, input, output, manifest, doc;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "vzpac-pipe-"));
    input = path.join(directory, "pipe.yml");
    output = path.join(directory, "generated", "chapter.md");
    manifest = path.join(directory, "figure's $(touch injected)", "assets.yml");
    fs.mkdirSync(path.join(directory, "families"));
    fs.writeFileSync(path.join(directory, "static.svg"), "<svg/>");
    fs.writeFileSync(path.join(directory, "families", "simulation.md"), [
      "---", "intro: 'Run ${architecture}.'", "---", "${intro}", "${commentary}",
      "![](${assets}-pipe-sim-complete.svg)", "![](${variant.assets}-pipe-sim-complete.svg)",
      "![static](../static.svg)", "%% [edit](${source}) %%"
    ].join("\n"));
    fs.writeFileSync(path.join(directory, "families", "assembly.md"), [
      "---", "intro: 'Assembly ${id}'", "---", "${intro}", "```asm", "${asm}", "```", "latency=${latency}"
    ].join("\n"));
    fs.writeFileSync(path.join(directory, "chapter.md"), [
      "# Chapter", "", "> [!exercise]", "> > ${first.exercise}", "", "${second.exercise}",
      "Source: ${source}", "", "[^units]: $\\frac{m}{s^2}$", "[static]: static.svg", ""
    ].join("\n"));
    doc = { mode: "inline", chapter: "chapter.md", template: "families/simulation.md", tag: "pipeline",
      sections: [{ title: "Simulation", exercises: [
        { id: "first", generate: { instructions: program }, commentary: "Variant latency=${variant.latency}" },
        { id: "variant", template: null, generate: { instructions: program, fw: true } }
      ] }, { title: "Assembly", template: "families/assembly.md", exercises: [
        { id: "second", generate: { instructions: [{ op: "nop" }] } }
      ] }] };
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  function save() { fs.writeFileSync(input, yaml.dump(doc)); }
  function generateFixture() { save(); generate(input, output, manifest); return fs.readFileSync(output, "utf8"); }

  it("resolves later asset-only variants, family overrides, nested quotes and static links without double rebasing", () => {
    const markdown = generateFixture();
    expect(markdown).to.include("[^units]: $\\frac{m}{s^2}$");
    expect(markdown).to.include("[static]: ../static.svg");
    expect(markdown).to.match(/^> > !\[\]\(/m);
    expect(markdown).to.include("[edit](../pipe.yml)");
    for (const id of ["first", "variant"]) {
      const destination = markdown.match(new RegExp(`!\\[\\]\\(([^\\n)]+/${id}/assets/${id}-pipe-sim-complete\\.svg)\\)`))[1];
      expect(path.resolve(path.dirname(output), decodeURIComponent(destination)))
        .to.equal(path.join(path.dirname(manifest), id, "assets", `${id}-pipe-sim-complete.svg`));
    }
    expect(markdown).to.include("![static](../static.svg)");
  });

  it("runs the public CLI and executes a manifest command into a metacharacter-containing directory", () => {
    save();
    const cli = path.resolve(__dirname, "../../vzpac.js");
    childProcess.execFileSync(process.execPath, [cli, "pipe", "exercises", input, "-o", output, "--manifest", manifest], { encoding: "utf8" });
    const entry = yaml.load(fs.readFileSync(manifest, "utf8")).first;
    fs.mkdirSync(path.join(path.dirname(manifest), "first", "assets"), { recursive: true });
    const command = entry.steps[0].replace(/^vzpac/, quote(process.execPath) + " " + quote(cli))
      .replace(" -c -s {prefix}", " -s {prefix}")
      .replace(/\{(\w+)\}/g, (match, key) => String(entry.vars[key]));
    childProcess.execSync(command, { cwd: directory, shell: "/bin/bash", encoding: "utf8" });
    expect(fs.readFileSync(path.join(path.dirname(manifest), "first", "assets", "first-asm-code.tex"), "utf8"))
      .to.include("sub x2, x1, x12");
    expect(fs.existsSync(path.join(directory, "injected"))).to.equal(false);
    expect(fs.readFileSync(output, "utf8")).to.include("latency=5");
  });

  it("does not rewrite unchanged generated files", () => {
    generateFixture();
    const old = new Date(1000000000000);
    fs.utimesSync(output, old, old);
    fs.utimesSync(manifest, old, old);
    generateFixture();
    expect(fs.statSync(output).mtimeMs).to.equal(old.getTime());
    expect(fs.statSync(manifest).mtimeMs).to.equal(old.getTime());
  });

  [
    { name: "unknown chapter ID", change: () => fs.appendFileSync(path.join(directory, "chapter.md"), "${absent.assets}") },
    { name: "missing model value", change: () => fs.appendFileSync(path.join(directory, "chapter.md"), "${first.comparisonCpi}") },
    { name: "unknown family placeholder", change: () => fs.appendFileSync(path.join(directory, "families", "assembly.md"), "${unknown}") },
    { name: "an unused declared instance", change: value => value.sections[1].exercises.push({ id: "unused", template: null, generate: { instructions: program } }) },
    { name: "a mutually referential unused instance group", change: value => value.sections[1].exercises.push(
      { id: "orphan-a", commentary: "${orphan-b.assets}", generate: { instructions: program } },
      { id: "orphan-b", commentary: "${orphan-a.assets}", generate: { instructions: program } }
    ) },
    { name: "a body reference to an asset-only instance", change: () => fs.appendFileSync(path.join(directory, "chapter.md"), "${variant.exercise}") },
    { name: "a malformed later program", change: value => { value.sections[1].exercises[0].generate.instructions = [{ op: "lw", d: 32, s1: 2 }]; } },
    { name: "a family reference cycle", change: () => fs.appendFileSync(path.join(directory, "families", "simulation.md"), "${first.exercise}") },
    { name: "duplicate IDs", change: value => { value.sections[1].exercises[0].id = "first"; } }
  ].forEach(example => {
    it(`rejects ${example.name} before replacing either generated output`, () => {
      generateFixture();
      const beforeMarkdown = fs.readFileSync(output, "utf8");
      const beforeManifest = fs.readFileSync(manifest, "utf8");
      example.change(doc);
      expect(generateFixture).to.throw(Error);
      expect(fs.readFileSync(output, "utf8")).to.equal(beforeMarkdown);
      expect(fs.readFileSync(manifest, "utf8")).to.equal(beforeManifest);
    });
  });

  it("rejects an output symlink that aliases a selected per-exercise template", () => {
    doc.sections[1].exercises[0].template = "families/assembly.md";
    save();
    fs.symlinkSync(path.join(directory, "families", "assembly.md"), path.join(directory, "alias.md"));
    const before = fs.readFileSync(path.join(directory, "families", "assembly.md"), "utf8");
    expect(() => generate(input, path.join(directory, "alias.md"), manifest)).to.throw(/must not overwrite/);
    expect(fs.readFileSync(path.join(directory, "families", "assembly.md"), "utf8")).to.equal(before);
  });
});
