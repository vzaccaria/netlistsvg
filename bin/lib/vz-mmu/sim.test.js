"use strict";

/* global describe, it */

const { expect } = require("chai");
const { generateSimulation, simulate, validateOptions } = require("./sim");

function options(changes) {
  return Object.assign({
    processes: ["p", "q"], npvbits: 2, npfbits: 2, wsbits: 1, upto: 1, policy: "LRU",
    accesses: [{ process: "p", npv: 0 }, { process: "q", npv: 0 }]
  }, changes);
}

function trace(pages) {
  return pages.map(npv => ({ process: "p", npv }));
}

function tableRows(code) {
  return code.split("\n").filter(line => /^\\texttt\{\d+\} & /.test(line))
    .map(line => line.replace(/\\\\\s*$/, "").split(" & "));
}

describe("MMU simulation", () => {
  it("counts seven LRU faults and nine FIFO faults on the frequently reused page example", () => {
    const input = options({ processes: ["p"], npvbits: 3,
      accesses: trace([0, 1, 0, 0, 7, 0, 2, 0, 3, 0, 5, 1]) });
    expect(generateSimulation(input).faults).to.deep.equal({ LRU: 7, FIFO: 9 });
    const lru = simulate(validateOptions(input));
    const fifo = simulate(validateOptions(Object.assign({}, input, { policy: "FIFO" })));
    expect(lru[5].pageTables.p[0].valid).to.equal(true);
    expect(fifo[5].pageTables.p[0].valid).to.equal(false);
    expect(lru[lru.length - 1].stats.p).to.equal(7);
    expect(fifo[fifo.length - 1].stats.p).to.equal(9);
  });

  it("allocates the lowest free frame, then replaces locally and reuses the freed frame", () => {
    const accesses = [
      { process: "p", npv: 0 }, { process: "q", npv: 0 },
      { process: "p", npv: 1 }, { process: "q", npv: 1 },
      { process: "p", npv: 0 }, { process: "p", npv: 2 }, { process: "q", npv: 2 }
    ];
    const states = simulate(validateOptions(options({ accesses })));
    expect(states[4].physical).to.deep.equal([
      { valid: true, process: "p", npv: 0 }, { valid: true, process: "q", npv: 0 },
      { valid: true, process: "p", npv: 1 }, { valid: true, process: "q", npv: 1 }
    ]);
    expect(states[6].physical[2]).to.deep.equal({ valid: true, process: "p", npv: 2 });
    expect(states[6].pageTables.q).to.deep.equal(states[5].pageTables.q);
    expect(states[7].physical[1]).to.deep.equal({ valid: true, process: "q", npv: 2 });
    expect(states[7].stats).to.deep.equal({ p: 3, q: 3 });
    expect(states[0].physical.every(frame => !frame.valid)).to.equal(true);
  });

  it("keeps blank answers through the inclusive cutoff and hides only answer cells afterwards", () => {
    const result = generateSimulation(options());
    for (const policy of ["lru", "fifo"]) {
      const complete = tableRows(result.latex.find(item => item.sfx === policy).code);
      const blank = tableRows(result.latex.find(item => item.sfx === policy + "-blank").code);
      expect(blank).to.have.lengthOf(3);
      expect(blank.slice(0, 2)).to.deep.equal(complete.slice(0, 2));
      expect(blank[2].slice(0, 2)).to.deep.equal(complete[2].slice(0, 2));
      expect(blank[2].slice(2).every(cell => cell.trim() === "")).to.equal(true);
    }
  });

  it("preserves the legacy zero cutoff including its hidden initial row", () => {
    const result = generateSimulation(options({ upto: 0 }));
    for (const artifact of result.latex.filter(item => /-blank$/.test(item.sfx))) {
      const rows = tableRows(artifact.code);
      expect(rows).to.have.lengthOf(3);
      expect(rows.every(row => row.slice(2).every(cell => !cell.trim()))).to.equal(true);
    }
    const full = generateSimulation(options({ upto: -1 }));
    expect(full.latex[2].code).to.equal(full.latex[0].code);
    expect(full.latex[3].code).to.equal(full.latex[1].code);
  });

  it("supports the single-page geometry and structured traces without altering shared input", () => {
    const input = options({ processes: ["worker"], npvbits: 0, npfbits: 0, wsbits: 0,
      accesses: [{ process: "worker", npv: 0 }, { process: "worker", npv: 0 }] });
    const before = JSON.stringify(input);
    expect(generateSimulation(input).faults).to.deep.equal({ LRU: 1, FIFO: 1 });
    expect(JSON.stringify(input)).to.equal(before);
  });

  [
    { name: "fractional geometry", change: value => { value.npvbits = 2.5; }, error: /npvbits/ },
    { name: "negative geometry", change: value => { value.wsbits = -1; }, error: /wsbits/ },
    { name: "huge geometry", change: value => { value.npfbits = 1000000000; }, error: /npfbits/ },
    { name: "impractical histories", change: value => { value.npvbits = 16; value.accesses = Array(100).fill({ process: "p", npv: 0 }); }, error: /simulation limit/ },
    { name: "insufficient physical frames", change: value => { value.npfbits = 1; }, error: /physical pages/ },
    { name: "oversized working sets", change: value => { value.npvbits = 0; }, error: /working set/ },
    { name: "duplicate processes", change: value => { value.processes = ["p", "p"]; }, error: /duplicate process/ },
    { name: "unsafe process names", change: value => { value.processes = ["p;touch sentinel"]; }, error: /process names/ },
    { name: "undeclared processes", change: value => { value.accesses[0].process = "missing"; }, error: /declared process/ },
    { name: "out-of-range pages", change: value => { value.accesses[0].npv = 4; }, error: /npv/ },
    { name: "string page numbers", change: value => { value.accesses[0].npv = "0"; }, error: /npv/ },
    { name: "scalar traces", change: value => { value.accesses = "p0,q0"; }, error: /accesses/ },
    { name: "empty traces", change: value => { value.accesses = []; }, error: /accesses/ },
    { name: "unknown policies", change: value => { value.policy = "random"; }, error: /policy/ },
    { name: "cutoffs past the trace", change: value => { value.upto = 3; }, error: /upto/ },
    { name: "fractional cutoffs", change: value => { value.upto = 0.5; }, error: /upto/ },
    { name: "unknown options", change: value => { value.seed = 1; }, error: /unknown option/ },
    { name: "unknown access fields", change: value => { value.accesses[0].page = 0; }, error: /unknown field/ }
  ].forEach(example => {
    it(`rejects ${example.name} before allocating or rendering`, () => {
      const input = options();
      example.change(input);
      expect(() => generateSimulation(input)).to.throw(example.error);
    });
  });
});
