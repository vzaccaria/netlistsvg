"use strict";

/* global describe, it, beforeEach, afterEach */
const { expect } = require("chai");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yaml = require("js-yaml");
const { execFileSync } = require("child_process");
const { generate } = require("./exercises");
const { generate: generateSeq } = require("../vz-seq/exercises");

describe("FSM inline collection", () => {
  let directory, input, output, manifest, document;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "vzpac-fsm-"));
    input = path.join(directory, "fsm.yml");
    output = path.join(directory, "generated", "fsm.md");
    manifest = path.join(directory, "figure's $(touch injected)", "fsm-assets.yml");
    fs.writeFileSync(path.join(directory, "chapter.md"), [
      "# FSM #excluded", "%% slide-off example: FSM %%", "![diagram](${machine.diagramAssets}.svg)",
      "> FF ${machine.flipFlop}", "> ${machine.excitationExpressionsMarkdown}",
      "> Start `${request.startSignal}` when ${request.completionCondition}",
      "${sr.nextLatex}", "%% /slide %%"
    ].join("\n"));
    document = { mode: "inline", passthrough: ["sr"], chapter: "chapter.md", tag: "fsm", sections: [{ title: "Machines", exercises: [
      { id: "machine", asset_name: "fsm", generate: { flipFlop: "SR", fsm: {
        type: "moore", inputSize: 1, outputSize: 1,
        transitions: [{ a: ["a", "b/b280"] }, { b: ["a", "b"] }],
        output: [[0], [1]], encodingSize: 2, encoding: { a: [0, 0], b: [1, 1] }
      } } },
      { id: "request", generate: { kind: "prose", request: { startSignal: "start", completionCondition: "the computation completes" } } }
    ] }] };
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  function run() {
    fs.writeFileSync(input, yaml.dump(document));
    generate(input, output, manifest);
    return { markdown: fs.readFileSync(output, "utf8"), assets: yaml.load(fs.readFileSync(manifest, "utf8")) };
  }
  function imagePaths(markdown) {
    return [...markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(match => path.resolve(path.dirname(output), decodeURIComponent(match[1])));
  }

  it("rebases external assets and regenerates the selected expression block when FF pin counts change", () => {
    const first = run();
    const root = path.join(path.dirname(manifest), "machine", "assets", "fsm");
    expect(imagePaths(first.markdown)).to.deep.equal(["diagram", "s-0-expression", "s-1-expression", "r-0-expression", "r-1-expression"].map(suffix => `${root}-${suffix}.svg`));
    expect(first.markdown).to.include("# FSM #excluded\n%% slide-off example: FSM %%");
    expect(first.markdown).to.include("> %% [edit](../fsm.yml) %%");
    expect(first.assets.request).to.deep.equal({ manual: true });
    document.sections[0].exercises[0].generate.flipFlop = "D";
    const changed = run();
    expect(changed.markdown).to.include("> FF D");
    expect(imagePaths(changed.markdown)).to.deep.equal(["diagram", "d-0-expression", "d-1-expression"].map(suffix => `${root}-${suffix}.svg`));
    expect(changed.markdown).not.to.include("-r-0-expression");
  });

  it("composes with the real sequential collection while the final pass remains strict", () => {
    const first = run();
    expect(first.markdown).to.include("${sr.nextLatex}");
    const seq = path.join(directory, "seq.yml"), final = path.join(directory, "final", "chapter.md"), combined = path.join(directory, "final", "assets.yml");
    fs.writeFileSync(seq, yaml.dump({ mode: "inline", chapter: "generated/fsm.md", base_assets: path.relative(directory, manifest), tag: "seq", sections: [{ title: "Latches", exercises: [
      { id: "sr", generate: { kind: "prose", variables: ["S", "R", "Q"], expressions: { next: "S | ~R & Q" } } }
    ] }] }));
    generateSeq(seq, final, combined);
    expect(fs.readFileSync(final, "utf8")).not.to.include("${");
    const jobs = yaml.load(fs.readFileSync(combined, "utf8"));
    const machineKey = path.relative(path.dirname(combined), path.join(path.dirname(manifest), "machine"));
    expect(jobs[machineKey].inputs["fsm.json"]).to.equal(first.assets.machine.inputs["fsm.json"]);
    fs.appendFileSync(output, "\n${sr.unknownField}");
    expect(() => generateSeq(seq, final, combined)).to.throw(/unknown placeholder/);
  });

  it("executes native draw-only CLI output safely with quoted manifest directories and a basename override", () => {
    const instance = document.sections[0].exercises[0];
    instance.generate.draw = true;
    delete instance.generate.flipFlop;
    delete instance.generate.fsm.encoding;
    delete instance.generate.fsm.encodingSize;
    document.sections[0].exercises = [instance];
    document.passthrough = [];
    fs.writeFileSync(path.join(directory, "chapter.md"), "![diagram](${machine.diagramAssets}.svg)");
    const { assets } = run();
    const job = assets.machine, jobDirectory = path.join(path.dirname(manifest), "machine");
    fs.mkdirSync(path.join(jobDirectory, "assets"), { recursive: true });
    fs.writeFileSync(path.join(jobDirectory, "fsm.json"), job.inputs["fsm.json"]);
    const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
    const command = job.steps[0].replace("vzpac fsm", `${quote(process.execPath)} ${quote(path.resolve(__dirname, "../../vz-fsm.js"))}`)
      .replace(" -c ", " ").replace(/\{qdir\}/g, () => job.vars.qdir);
    execFileSync("/bin/sh", ["-c", command], { cwd: directory });
    const diagram = fs.readFileSync(path.join(jobDirectory, "assets", "fsm-diagram.tex"), "utf8");
    expect(diagram).to.include("bend left=280");
    expect(fs.existsSync(path.join(directory, "injected"))).to.equal(false);
    expect(fs.existsSync(path.join(jobDirectory, "assets", "fsm-transition-table.tex"))).to.equal(false);
  });

  it("rejects undeclared deferred IDs, owned/deferred collisions and invalid models without replacing outputs", () => {
    run();
    const previous = [output, manifest].map(file => fs.readFileSync(file, "utf8"));
    document.passthrough = ["other"];
    expect(run).to.throw(/unknown placeholder/);
    document.passthrough = ["sr", "machine"];
    expect(run).to.throw(/cannot also be a passthrough/);
    document.passthrough = ["sr"];
    document.sections[0].exercises[0].generate.fsm.initial = "absent";
    expect(run).to.throw(/initial: unknown state/);
    expect([output, manifest].map(file => fs.readFileSync(file, "utf8"))).to.deep.equal(previous);
  });
});
