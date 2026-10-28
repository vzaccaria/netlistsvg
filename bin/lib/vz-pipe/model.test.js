"use strict";

/* global describe, it */
const { expect } = require("chai");
const { run, generateArtifacts } = require("./lib");
const { generateModel } = require("./model");
const { MAX_INSTRUCTIONS } = require("./program");

const small = [{ op: "add", d: 2, s1: 9, s2: 10 }, { op: "beq", s1: 2, s2: 1 }];
const large = [{ op: "lw", d: 1, s1: 3 }, { op: "sub", d: 2, s1: 1, s2: 10 }, { op: "beq", s1: 2, s2: 5 }];

describe("pipeline declarative model", () => {
  it("derives two-instruction baseline and optimized throughput from completion schedules", () => {
    const model = generateModel({ instructions: small, repeat: 3, comparison: { fw: true, branchopt: true } });
    expect(model.metrics).to.include({ instructionsPerIteration: 2, instructionCount: 6, stallsPerIteration: 5,
      dataStalls: 2, branchStalls: 3, cpi: 3.5, comparisonStalls: 2, comparisonDataStalls: 1,
      comparisonBranchStalls: 1, comparisonCpi: 2, speedupPercent: 75 });
    expect(model.values.asm).to.equal("lab:\nadd x2, x9, x10\nbeq x2, x1, lab");
  });

  it("derives three-instruction CPI and truncates speedup only for display", () => {
    const model = generateModel({ instructions: large, repeat: 2, comparison: { fw: true, branchopt: true } });
    expect(model.metrics).to.include({ stallsPerIteration: 7, dataStalls: 4, branchStalls: 3,
      comparisonStalls: 3, comparisonDataStalls: 2, comparisonBranchStalls: 1, comparisonCpi: 2, speedupPercent: 66 });
    expect(model.values.cpi).to.equal("3.33");
    expect(model.values.asymptoticMips).to.equal("180");
  });

  it("derives changed dependencies and reverse comparison rather than assuming historical stalls", () => {
    const independent = [{ op: "add", d: 3, s1: 9, s2: 10 }, { op: "beq", s1: 2, s2: 1 }];
    const result = generateModel({ instructions: independent, repeat: 2, fw: true, branchopt: true,
      comparison: { fw: false, branchopt: false }, frequencyMHz: 900 });
    expect(result.metrics).to.include({ stallsPerIteration: 1, dataStalls: 0, cpi: 1.5,
      comparisonStalls: 3, comparisonCpi: 2.5, speedupPercent: -40, asymptoticMips: 600 });
  });

  it("accounts for every taken branch in a repeated execution trace", () => {
    const instructions = [{ op: "beq", s1: 1, s2: 2 }, { op: "beq", s1: 3, s2: 4 }];
    const result = generateModel({ instructions, repeat: 2, comparison: { branchopt: true } });
    expect(result.metrics).to.include({ stallsPerIteration: 6, branchStalls: 6, dataStalls: 0, cpi: 4,
      comparisonStalls: 2, comparisonBranchStalls: 2, comparisonDataStalls: 0, comparisonCpi: 2 });
  });

  it("measures finite latency independently of padded diagram width", () => {
    const result = generateModel({ instructions: [{ op: "nop" }], maxCycles: 100 });
    expect(result.metrics).to.include({ latency: 5, finiteCpi: 5, finiteMips: 120 });
    expect(result.artifacts.state.table[0].pipe).to.have.length(100);
  });

  it("accepts direct structured instructions including stores and harmless placeholders", () => {
    const result = generateArtifacts({ fw: true }, [
      { op: "sw", s1: 2, s2: 11 }, { op: "or", d: 31, s1: 0, s2: 2 }, { op: "anything" }, { op: "nop" }
    ]);
    expect(result.state.table.map(row => row.ins)).to.deep.equal(["sw x2, lab(x11)", "or x31, x0, x2", "...", "nop"]);
    expect(result.state.table.map(row => row.n_we)).to.deep.equal([4, 5, 6, 7]);
  });

  [
    "process.exit()", "lw(1)(10);global.__pipeInjected=true", "lw(1)(10),(()=>{global.__pipeInjected=true})()",
    "add(1)(2)", "add(1,2,3,4)", "lw(-1,2)", "lw(32,2)", "lw(1e1,2)", "lw(1,2),", "nop()()", "lw()(1)(2)", ""
  ].forEach(program => {
    it(`rejects non-program input ${JSON.stringify(program)}`, () => {
      expect(() => run({}, program)).to.throw(Error);
      expect(global.__pipeInjected).to.equal(undefined);
    });
  });

  [
    { instructions: [] }, { instructions: [{ op: "add", d: 1, s1: 2 }] },
    { instructions: [{ op: "nop", d: 1 }] }, { instructions: [{ op: "constructor" }] },
    { instructions: [{ op: "nop" }], typo: true }, { instructions: small, repeat: 0 },
    { instructions: small, repeat: MAX_INSTRUCTIONS }, { instructions: small, fw: "false" },
    { instructions: small, maxCycles: Infinity }, { instructions: small, maxCycles: 4097 },
    { instructions: small, maxCycles: "10" }, { instructions: small, asmIns: 3 },
    { instructions: small, hrowsep: 0 }, { instructions: small, hrowsep: NaN },
    { instructions: small, frequencyMHz: 0 }, { instructions: small, frequencyMHz: Infinity },
    { instructions: small, comparison: { forwarding: true } },
    { instructions: small, comparison: { fw: true } },
    { instructions: small, conflicts: "cw0d1" },
    { instructions: small, conflicts: [{ type: "c", from: { instruction: 2, stage: "w" }, to: { instruction: 1, stage: "d" } }] },
    { instructions: small, conflicts: [{ type: "c", from: { instruction: 0, stage: "w;evil" }, to: { instruction: 1, stage: "d" } }] },
    { instructions: small, conflicts: [{ type: "f", from: { instruction: 0, stage: "w" }, to: { instruction: 1, stage: "e" } }] }
  ].forEach((options, index) => {
    it(`rejects malformed or unbounded structured configuration ${index}`, () => {
      expect(() => generateModel(options)).to.throw(Error);
    });
  });

  it("bounds the total rendering cells even when both dimensions are separately valid", () => {
    expect(() => generateArtifacts({ maxCycles: 4096 }, Array(65).fill({ op: "nop" }))).to.throw(/geometry/);
  });

  it("refuses asymptotic inference without enough bounded iterations to prove steady state", () => {
    const instructions = Array(64).fill({ op: "nop" }).concat({ op: "beq", s1: 1, s2: 2 });
    expect(() => generateModel({ instructions, repeat: 2 })).to.throw(/stable completion period/);
  });
});
