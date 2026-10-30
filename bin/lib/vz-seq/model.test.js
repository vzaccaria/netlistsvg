"use strict";

/* global describe, it */
const { expect } = require("chai");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const vcdParser = require("vcd-parser");
const { generateModel } = require("./model");

function fixture() {
  return {
    circuit: {
      inputs: ["I", "sel", "clk", "rst"], outputs: ["F"], wires: ["d", "q"],
      equations: { d: "I", F: { mux: { select: "sel", whenTrue: "q", whenFalse: "I" } } },
      flops: [{ type: "dffmsn", name: "ff", ports: ["d", "clk", "rst", "q"] }]
    },
    testbench: {
      regs: { clk: 0, i: 1, sel: "x", rst: 0, unused: 0 }, wires: ["f"], ports: ["i", "sel", "clk", "rst", "f"],
      clock: { signal: "clk", halfPeriod: 2 },
      events: [{ delay: 0, set: { rst: 1 } }, { delay: 1, set: { rst: 0 } }, { delay: 1, set: { i: 0, unused: 1 } }, { delay: 3, finish: true }]
    },
    wave: { end: 6, signals: ["test.i", "test.f", "test.dut.q"], whitelist: ["I"] }
  };
}

async function simulate(options) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "seq native ' "));
  try {
    const model = generateModel(options);
    fs.writeFileSync(path.join(directory, "test.v"), model.rtl);
    fs.writeFileSync(path.join(directory, "test_cb.v"), model.testbench);
    execFileSync("iverilog", ["-o", "exe", "test_cb.v"], { cwd: directory });
    execFileSync("vvp", ["exe"], { cwd: directory });
    const vcd = await vcdParser.parse(fs.readFileSync(path.join(directory, "test.vcd"), "utf8"));
    return { model, vcd, at(name, time) {
      const signal = vcd.signal.find(item => item.name.replace(/\[\d+:\d+\]$/, "") === name);
      expect(signal, `VCD declaration ${name}`).not.to.equal(undefined);
      const events = signal.wave.filter(([t]) => Number(t) <= time);
      return events[events.length - 1][1];
    } };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

describe("native sequential model (requires Icarus Verilog)", () => {
  it("preserves mux four-state merging, explicit relative delays and deliberately unused regs", async () => {
    const { at, model } = await simulate(fixture());
    expect(at("test.f", 1)).to.equal("1"); // X selector, equal branches: native ?: is NOT an SOP rewrite.
    expect(at("test.f", 2)).to.equal("x");
    expect(at("test.f", 4)).to.equal("0");
    expect(at("test.unused", 1)).to.equal("0");
    expect(at("test.unused", 2)).to.equal("1");
    expect(model.values.qReset).to.equal(1);
  });

  it("keeps independent reset and falling-edge processes for all four primitives", async () => {
    const options = {
      circuit: {
        inputs: ["I", "R", "S", "clk", "rst"], outputs: ["dq", "nq", "rq", "tq"], wires: ["d"],
        equations: { d: "I" },
        flops: [
          { type: "dffms", name: "df", ports: ["d", "clk", "rst", "dq"] },
          { type: "dffmsn", name: "nf", ports: ["d", "clk", "rst", "nq"] },
          { type: "rsffms", name: "rf", ports: ["R", "S", "clk", "rst", "rq"] },
          { type: "tffms", name: "tf", ports: ["I", "clk", "rst", "tq"] }
        ]
      },
      testbench: {
        regs: { clk: 0, i: 1, r: 0, s: 1, rst: 0 }, wires: ["od", "on", "orr", "ot"],
        ports: ["i", "r", "s", "clk", "rst", "od", "on", "orr", "ot"], clock: { signal: "clk", halfPeriod: 2 },
        events: [{ delay: 0, set: { rst: 1 } }, { delay: 5, set: { s: 0 } },
          { delay: 4, set: { r: 1, s: 1 } }, { delay: 4, set: { i: 0 } }, { delay: 4, finish: true }]
      },
      wave: { end: 18, whitelist: ["I", "CLK"] }
    };
    const { at, model } = await simulate(options);
    expect(["od", "on", "orr", "ot"].map(name => at(`test.${name}`, 0))).to.deep.equal(["0", "1", "0", "0"]);
    expect(["od", "on", "orr", "ot"].map(name => at(`test.${name}`, 4))).to.deep.equal(["1", "1", "1", "1"]);
    expect(at("test.orr", 8)).to.equal("1"); // R=S=0 holds.
    expect(at("test.orr", 12)).to.equal("0"); // R=S=1 uses the historical native equation.
    expect(at("test.ot", 8)).to.equal("0");
    expect(at("test.ot", 12)).to.equal("1");
    expect(at("test.ot", 16)).to.equal("1"); // T=0 holds.
    expect(at("test.od", 16)).to.equal("0"); // Reset remains high, but clock still samples D.
    expect(model.values).to.include({ dqReset: 0, nqReset: 1, rqReset: 0, tqReset: 0 });
  });

  it("preserves packed state values through reset, input changes and clock sampling", async () => {
    const options = fixture();
    options.circuit.buses = { stateBus: ["q", "d"], inputBus: ["I", "sel"] };
    options.wave = { renderer: "sootty", signals: ["stateBus", "inputBus"], whitelist: ["inputBus"], end: 5, radix: 2 };
    const { at } = await simulate(options);
    expect(parseInt(at("test.dut.stateBus", 1), 2)).to.equal(3);
    expect(parseInt(at("test.dut.stateBus", 2), 2)).to.equal(2);
    expect(parseInt(at("test.dut.stateBus", 4), 2)).to.equal(0);
  });

  it("compiles bounded scalar equations independently while native assigns resolve larger networks", async () => {
    const options = fixture();
    options.circuit.equations.F = "stage11";
    for (let index = 0; index < 12; index++) {
      options.circuit.wires.push(`stage${index}`);
      options.circuit.equations[`stage${index}`] = `${index ? `stage${index - 1}` : "I"} ^ q`;
    }
    const { at } = await simulate(options);
    expect(at("test.f", 1)).to.equal("1");
    expect(at("test.f", 2)).to.equal("0");
    expect(at("test.f", 4)).to.equal("0");
  });

  it("rejects sootty ambiguity across unselected hierarchy aliases, not just selected duplicates", () => {
    const options = fixture();
    options.wave = { renderer: "sootty", signals: ["clk", "q"], whitelist: ["clk"], end: 5 };
    expect(() => generateModel(options)).to.throw(/ambiguous display basename/);
    options.wave.signals = ["test.dut.q"];
    expect(() => generateModel(options)).to.throw(/invalid Verilog identifier/);
  });

  const invalid = [
    ["nonfinite duration", o => { o.wave.end = Infinity; }, /integer/],
    ["zero clock period", o => { o.testbench.clock.halfPeriod = 0; }, /integer/],
    ["negative delay", o => { o.testbench.events[0].delay = -1; }, /integer/],
    ["missing finish", o => { o.testbench.events.pop(); }, /finish/],
    ["early finish", o => { o.testbench.events[0] = { delay: 0, finish: true }; }, /final event/],
    ["unbounded run", o => { o.testbench.events[3].delay = 1000000; }, /exceeds/],
    ["clock double driver", o => { o.testbench.events[0].set.clk = 1; }, /cannot drive/],
    ["unknown signal", o => { o.circuit.equations.d = "absent"; }, /unknown variable/],
    ["multiple drivers", o => { o.circuit.equations.q = "I"; }, /multiple drivers/],
    ["reserved identifier", o => { o.circuit.wires.push("assign"); }, /invalid Verilog/],
    ["bus collision", o => { o.circuit.buses = { q: ["q", "d"] }; }, /collides/],
    ["unknown bus bit", o => { o.circuit.buses = { stateBus: ["q", "absent"] }; }, /declared scalar/],
    ["shell injection in signal", o => { o.wave.signals = ["test.i;touch BAD"]; }, /hierarchical signals/],
    ["unknown configuration", o => { o.netlist = { script: "shell command" }; }, /unknown option/]
  ];
  for (const [label, change, error] of invalid) it(`rejects ${label}`, () => {
    const options = fixture(); change(options);
    expect(() => generateModel(options)).to.throw(error);
  });
});
