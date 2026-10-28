"use strict";

/* global describe, it */
const { expect } = require("chai");
const { generateModel } = require("./model");

function schedule() {
  return {
    timer: 0.5, runfor: 4,
    class: { type: "CFS", latency: 6, mingran: 0.75, wgup: 1 },
    tasks: [{ index: 0, name: "A", lambda: 1, start: 0, events: [1, 1, 1], vrt: 0 }],
    graphics: { vspace: 1, hspace: 1, barheight: 0.5 }
  };
}

describe("declarative CFS model", () => {
  it("preserves the native initial deadline offset and omitted-vrt debit for off-grid arrivals", () => {
    const data = schedule();
    data.tasks[0].start = 0.75;
    delete data.tasks[0].vrt;
    const result = generateModel(data);
    // Initial deadlines are relative to walltime=-timer: -0.5+0.75=0.25,
    // serviced at 0.5. Changing this scheduling convention is not a format migration.
    expect(result.artifacts.conditions[0]).to.include({ kind: "start", time: 0.5, vrtAfter: 6, decision: "no-curr" });
    expect(result.artifacts.history.find(row => row.time === 0.5).rbt[0]).to.include({ vrt: 6, sum: 0 });
    expect(data.tasks[0]).not.to.have.property("vrt");
  });

  it("accepts off-grid waits and returns the actual recorded wakeup count", () => {
    const data = schedule();
    data.tasks[0].events = [1, 0.75, 1];
    const result = generateModel(data);
    expect(result.artifacts.conditions.find(row => row.kind === "wakeup")).to.include({ time: 2, decision: "no-curr" });
    expect(result.values.wakeupCount).to.equal("1");
  });

  it("resolves mixed named/indexed initial order without sorting task definitions or plotting rows", () => {
    const data = schedule();
    data.tasks = [
      { index: 2, name: "C", lambda: 1, start: 0, events: [4], vrt: 0 },
      { index: 0, name: "A", lambda: 1, start: 0, events: [4], vrt: 0 },
      { index: 1, name: "B", lambda: 1, start: 0, events: [4], vrt: 0 }
    ];
    data.initialrq = ["B", 0];
    const result = generateModel(data);
    expect(result.artifacts.history[0].rbt.map(task => task.name)).to.deep.equal(["B", "A", "C"]);
    expect(data.tasks.map(task => task.index)).to.deep.equal([2, 0, 1]);
    expect(result.artifacts.history.find(row => row.time === 2).rbt.find(task => task.R === "X").name).to.equal("A");
  });

  [
    data => { data.timer = 0; },
    data => { data.timer = 0.0001; },
    data => { data.timer = 0.0015; },
    data => { data.runfor = Infinity; },
    data => { data.runfor = 0; },
    data => { data.runfor = 4096; },
    data => { data.class.type = "EEVDF"; },
    data => { data.class.latency = 0; },
    data => { data.class.wgup = -1; },
    data => { data.graphics.hspace = NaN; },
    data => { data.tasks[0].index = 1; },
    data => { data.tasks[0].lambda = 0; },
    data => { data.tasks[0].start = -1; },
    data => { data.tasks[0].vrt = Infinity; },
    data => { data.tasks[0].events = []; },
    data => { data.tasks[0].events = [0.75]; },
    data => { data.tasks[0].events = [0]; },
    data => { data.tasks[0].events = [1, -1, 1]; },
    data => { data.tasks[0].events = Array(40000).fill(1); },
    data => { data.initialrq = ["missing"]; },
    data => { data.initialrq = ["A", 0]; },
    data => { data.tasks[0].typo = 1; },
    data => { data.tasks.push(Object.assign({}, data.tasks[0])); },
    data => { data.tasks.push(Object.assign({}, data.tasks[0], { index: 1 })); }
  ].forEach((change, index) => {
    it(`rejects malformed or unbounded native schedule ${index} before simulation`, () => {
      const data = schedule();
      change(data);
      expect(() => generateModel(data)).to.throw(Error);
    });
  });
});
