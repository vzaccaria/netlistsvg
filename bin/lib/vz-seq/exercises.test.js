"use strict";

/* global describe, it, beforeEach, afterEach */
const { expect } = require("chai");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yaml = require("js-yaml");
const { execFileSync } = require("child_process");
const vcdParser = require("vcd-parser");
const { generate } = require("./exercises");

describe("sequential inline collection", () => {
  let directory, input, output, manifest, document;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "vzpac-seq-"));
    input = path.join(directory, "seq.yml");
    output = path.join(directory, "generated", "chapter.md");
    manifest = path.join(directory, "figure's $(touch injected)", "assets.yml");
    fs.writeFileSync(path.join(directory, "chapter.md"), [
      "# Sequential", "![diagram](${circuit.diagramAssets}.pdf)", "![wave](${circuit.waveAssets}.pdf)",
      "![blank](${circuit.maskedWaveAssets}.pdf)", "![SR](${sr.circuitFigure})", "$${sr.nextLatex}$"
    ].join("\n"));
    document = { mode: "inline", chapter: "chapter.md", tag: "seq", sections: [{ title: "Sequential", exercises: [
      { id: "circuit", generate: {
        circuit: { inputs: ["I", "clk", "rst"], outputs: ["Z"], wires: ["d", "q"],
          equations: { d: "I ^ q", Z: "q" }, flops: [{ type: "dffms", name: "ff", ports: ["d", "clk", "rst", "q"] }] },
        testbench: { regs: { clk: 0, i: 1, rst: 0 }, wires: ["z"], ports: ["i", "clk", "rst", "z"],
          clock: { signal: "clk", halfPeriod: 2 }, events: [{ delay: 0, set: { rst: 1 } }, { delay: 1, set: { rst: 0 } }, { delay: 8, finish: true }] },
        wave: { end: 10, signals: ["test.i", "test.z"], whitelist: ["I"] }
      } },
      { id: "sr", generate: { kind: "prose", variables: ["S", "R", "Q"], expressions: { next: "S | ~R & Q" }, circuitFigure: "figures/latch sr.svg" } }
    ] }] };
    fs.mkdirSync(path.join(directory, "figures"));
    fs.writeFileSync(path.join(directory, "figures", "latch sr.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  function run() {
    fs.writeFileSync(input, yaml.dump(document));
    generate(input, output, manifest);
    return { markdown: fs.readFileSync(output, "utf8"), assets: yaml.load(fs.readFileSync(manifest, "utf8")) };
  }

  it("rebases both generated diagrams and canonical prose figures from their distinct source roots", () => {
    const { markdown } = run();
    const paths = [...markdown.matchAll(/!\[[^\]]+\]\(([^)]+)\)/g)]
      .map(match => path.resolve(path.dirname(output), decodeURIComponent(match[1])));
    expect(paths).to.deep.equal([
      ...["test-diag.pdf", "test-wave.pdf", "test-wave-whitelisted.pdf"].map(name => path.join(path.dirname(manifest), "circuit", "assets", name)),
      path.join(directory, "figures", "latch sr.svg")
    ]);
  });

  it("executes the real generated simulation safely under apostrophes and shell metacharacters", async () => {
    const { assets } = run();
    const job = assets.circuit;
    const jobDirectory = path.join(path.dirname(manifest), "circuit");
    fs.mkdirSync(jobDirectory, { recursive: true });
    for (const [filename, content] of Object.entries(job.inputs)) fs.writeFileSync(path.join(jobDirectory, filename), content);
    for (const step of job.steps.slice(0, 2)) execFileSync("/bin/sh", ["-c", step.replace(/\{qdir\}/g, () => job.vars.qdir)], { cwd: directory });
    const vcd = await vcdParser.parse(fs.readFileSync(path.join(jobDirectory, "test.vcd"), "utf8"));
    const signal = vcd.signal.find(item => item.name === "test.z");
    expect(signal.wave.map(([time, value]) => [Number(time), value])).to.deep.equal([[0, "0"], [4, "1"], [8, "0"]]);
    expect(fs.existsSync(path.join(directory, "injected"))).to.equal(false);
  });

  it("rejects ambiguous sootty selection before replacing either previous output", () => {
    run();
    const previous = [output, manifest].map(file => fs.readFileSync(file, "utf8"));
    document.sections[0].exercises[0].generate.wave = { renderer: "sootty", signals: ["clk", "q"], whitelist: ["clk"], end: 10 };
    expect(run).to.throw(/ambiguous display basename/);
    expect([output, manifest].map(file => fs.readFileSync(file, "utf8"))).to.deep.equal(previous);
  });

  it("rejects an absolute prose figure instead of silently changing its reference root", () => {
    document.sections[0].exercises[1].generate.circuitFigure = path.join(directory, "figures", "latch sr.svg");
    expect(run).to.throw(/must be relative to the input YAML/);
    expect(fs.existsSync(output)).to.equal(false);
    expect(fs.existsSync(manifest)).to.equal(false);
  });
});
