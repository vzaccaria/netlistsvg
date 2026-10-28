"use strict";

/* global describe, it */
const { expect } = require("chai");
const { eventLoop, generateArtifacts } = require("./lib");

function schedule(initialrq) {
  return {
    timer: 0.5, runfor: 8,
    class: { type: "CFS", latency: 6, mingran: 0.75, wgup: 1 },
    initialrq,
    tasks: [
      { index: 0, name: "A", lambda: 1, start: 0, events: [8], vrt: 0 },
      { index: 1, name: "B", lambda: 1, start: 0, events: [8], vrt: 0 },
      { index: 2, name: "C", lambda: 1, start: 0, events: [8], vrt: 0 }
    ],
    graphics: { vspace: 1, hspace: 1, barheight: 0.5 }
  };
}
const at = (history, time) => history.find(row => row.time === time);
const running = row => row.rbt.find(task => task.R === "X").name;

function waiting(omega) {
  const data = schedule();
  data.class.wgup = omega;
  data.tasks[2].lambda = 2;
  data.tasks[2].events = [1, 1, 6];
  return data;
}

describe("canonical CFS timing", () => {
  [
    { initialrq: ["B", "C", "A"], order: ["B", "C", "A"] },
    { initialrq: [2, 0, 1], order: ["C", "A", "B"] },
    { initialrq: ["C"], order: ["C", "A", "B"] },
    { initialrq: undefined, order: ["A", "B", "C"] }
  ].forEach(({ initialrq, order }) => {
    it(`retains configured initial order ${JSON.stringify(initialrq)} and stable equal-runtime rotation`, () => {
      const history = eventLoop({}, schedule(initialrq));
      expect(at(history, 0).rbt.map(task => task.name)).to.deep.equal(order);
      expect(running(at(history, 0))).to.equal(order[0]);
      expect(running(at(history, 2))).to.equal(order[1]);
      expect(running(at(history, 4))).to.equal(order[2]);
      expect(running(at(history, 6))).to.equal(order[0]);
    });
  });

  it("uses weighted quanta and reciprocal virtual-runtime progress without mid-quantum preemption", () => {
    const data = schedule();
    data.tasks[2].lambda = 2;
    const history = eventLoop({}, data);
    expect(running(at(history, 3))).to.equal("C");
    expect(at(history, 4).rbt.find(task => task.name === "C")).to.include({ vrt: 0.5, q: 3, sum: 1 });
    expect(at(history, 4).rbt.find(task => task.name === "A")).to.include({ vrt: 1.5, q: 1.5 });
    expect(running(at(history, 5.5))).to.equal("C");
    expect(running(at(history, 6))).to.equal("A");
  });

  it("preempts at wakeup using omega divided by the waking weight", () => {
    const history = eventLoop({}, waiting(1));
    const condition = history.conditions.find(row => row.kind === "wakeup");
    expect(condition).to.include({ task: "C", time: 5, lambda: 2, vrtBefore: 0.5, vrtAfter: 0.5,
      vminUsed: 1.5, v: 1, currTask: "A", currVrt: 2.5, decision: "preempt" });
    expect(running(at(history, 5))).to.equal("C");
  });

  it("does not preempt on equality at the wakeup threshold", () => {
    const history = eventLoop({}, waiting(4));
    expect(history.conditions.find(row => row.kind === "wakeup"))
      .to.include({ v: 2.5, currVrt: 2.5, decision: "keep" });
    expect(running(at(history, 5))).to.equal("A");
  });

  it("retains the virtual-time reference across idle and schedules a wakeup without a current task", () => {
    const data = schedule();
    data.tasks = [{ index: 0, name: "A", lambda: 1, start: 0, events: [0.5, 2, 0.5], vrt: 0 }];
    const history = eventLoop({}, data);
    expect(at(history, 1).rbt).to.deep.equal([]);
    expect(history.conditions.find(row => row.kind === "wakeup"))
      .to.include({ time: 2.5, vrtBefore: 0.5, vrtAfter: 0.5, vminUsed: 0.5, decision: "no-curr" });
    expect(running(at(history, 2.5))).to.equal("A");
  });

  it("exits after a final wait without inventing a following CPU burst or wakeup comparison", () => {
    const data = schedule(["A"]);
    data.runfor = 2;
    data.tasks = [{ index: 0, name: "A", lambda: 1, start: 0, events: [0.5, 0.5], vrt: 0 }];
    const history = eventLoop({}, data);
    expect(history[history.length - 1].blocked[0]).to.include({ exited: 1, sum: 0.5 });
    expect(history[history.length - 1].rbt).to.deep.equal([]);
    expect(history.conditions.filter(row => row.kind === "wakeup")).to.deep.equal([]);
  });

  it("does not mutate shared task or event arrays while generating figures", () => {
    const data = waiting(1);
    const before = JSON.parse(JSON.stringify(data));
    delete data.initialrq;
    delete before.initialrq;
    const result = generateArtifacts({}, data);
    expect(data).to.deep.equal(before);
    expect(result.finalSchedule.tasks.find(task => task.name === "C").events).not.to.deep.equal(before.tasks[2].events);
    expect(result.conditions.find(row => row.kind === "wakeup")).to.include({ time: 5, decision: "preempt" });
  });
});
