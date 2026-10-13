"use strict";

/* global describe, it */
const { expect } = require("chai");
const { generateSimulation } = require("./sim");
const { generateConfig, log2Exact } = require("./config");

function generated(overrides) {
  return generateSimulation(Object.assign({ seed: "behavior", blocks: 4, ways: 1, membits: 10, blockbits: 2, accesses: 8, hits: 3 }, overrides));
}
function rejects(options) {
  let failure;
  try { generateSimulation(options); } catch (error) { failure = error; }
  expect(failure, JSON.stringify(options)).not.to.equal(undefined);
}
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function types(sim) { return sim.results.actions.slice(1).map(action => action.type); }
function coldEntries(count) { return Array.from({ length: count }, () => ({ valid: false, tag: "0", data: 37 })); }

describe("canonical cache simulation", () => {
  it("uses actual ways and two or four flat set-major blocks", () => {
    for (const blocks of [2, 4]) {
      for (const ways of blocks === 2 ? [1, 2] : [1, 2, 4]) {
        const sim = generated({ blocks, ways });
        expect(sim.config.numberOfBlocks).to.equal(blocks);
        expect(sim.config.associativity).to.equal(ways);
        expect(sim.config.numberOfSets).to.equal(blocks / ways);
        expect(sim.config.cacheBytes).to.equal(blocks * 4);
        for (const action of sim.results.actions) expect(action.state).to.have.lengthOf(blocks);
      }
    }
  });

  it("calculates different hits for the same aliased accesses under different ways", () => {
    const accesses = freeze(["0000", "0100", "0001"]);
    const opts = { blocks: 2, membits: 4, blockbits: 1, accesses };
    const direct = generateSimulation(Object.assign({ ways: 1 }, opts));
    const associative = generateSimulation(Object.assign({ ways: 2 }, opts));
    expect(types(direct)).to.deep.equal(["miss", "miss", "miss"]);
    expect(types(associative)).to.deep.equal(["miss", "miss", "hit"]);
    expect(direct.trace.map(row => row.address)).to.deep.equal(accesses);
    expect(associative.trace.map(row => row.address)).to.deep.equal(accesses);
    expect(associative.hitCount).to.equal(1);
    expect(direct.conflictCount).to.equal(2);
  });

  it("keeps maximum 52-bit byte addresses exact and accepts integer CLI strings", () => {
    const address = "1".repeat(52);
    const sim = generateSimulation({ seed: 0, blocks: "2", ways: "1", membits: "52", blockbits: "0", accesses: [address, address] });
    expect(types(sim)).to.deep.equal(["miss", "hit"]);
    expect(sim.trace[0].blockNumber).to.equal(Math.pow(2, 52) - 1);
    expect(sim.results.cache[1].data).to.equal(Math.pow(2, 52) - 1);
    expect(sim.trace[0].tagBits).to.equal("1".repeat(51));
  });

  it("preserves explicit spaces, leading zeros, and historical data on a populated hit", () => {
    const initial = freeze([
      { valid: true, tag: "0001", data: 91 },
      { valid: false, tag: "0", data: 37 },
      { valid: false, tag: "0010", data: 2 },
      { valid: false, tag: "0011", data: 3 }
    ]);
    const accesses = freeze(["0001 00 00", "0001 01 00", "0001 01 01"]);
    const sim = generateSimulation({ seed: 0, ways: 1, membits: 8, blockbits: 2, accesses, initial });
    expect(sim.initial).to.deep.equal(initial);
    expect(sim.results.actions[0].state).to.deep.equal(initial);
    expect(types(sim)).to.deep.equal(["hit", "miss", "hit"]);
    expect(sim.trace.map(row => row.address)).to.deep.equal(accesses);
    expect(sim.trace[0].tagBits).to.equal("0001");
    expect(sim.trace[0].action).to.equal("leggo mem[4]");
    expect(sim.results.actions[1].description).to.equal("leggo mem[4] in cache[0]");
    expect(sim.results.actions[1].access).to.equal(accesses[0]);
    expect(sim.results.actions[1].state[0].data).to.equal(91);
    expect(sim.results.cache[1]).to.deep.equal({ valid: true, tag: "0001", data: 5 });
    expect(sim.results.cache[2]).to.deep.equal(initial[2]);
    expect(initial[0].data).to.equal(91);
  });

  it("fills the first invalid slot, then evicts tied unaccessed slots before newer lines", () => {
    const initial = [
      { valid: true, tag: "0000", data: 99 },
      { valid: false, tag: "0", data: 7 },
      { valid: true, tag: "0010", data: 200 },
      { valid: false, tag: "0", data: 9 }
    ];
    const sim = generateSimulation({ ways: 4, membits: 6, blockbits: 2, initial,
      accesses: ["001100", "010000", "010100", "001001", "011000"] });
    const states = sim.results.actions.slice(1).map(action => action.state);
    expect(states[0].map(line => line.data)).to.deep.equal([99, 3, 200, 9]);
    expect(states[1].map(line => line.data)).to.deep.equal([99, 3, 200, 4]);
    expect(states[2].map(line => line.data)).to.deep.equal([5, 3, 200, 4]);
    expect(states[3].map(line => line.data)).to.deep.equal([5, 3, 200, 4]);
    expect(states[4].map(line => line.data)).to.deep.equal([5, 6, 200, 4]);
    expect(sim.conflictCount).to.equal(2);
    expect(sim.results.actions[4].description).to.equal("leggo mem[2] in cache");
    expect(states.map(state => state.findIndex(line => line.highlight))).to.deep.equal([1, 3, 0, 2, 1]);
    states.forEach(state => expect(state.filter(line => line.highlight)).to.have.lengthOf(1));
  });

  it("reproduces fully associative cold-cache LRU transitions", () => {
    const sim = generateSimulation({ ways: 4, membits: 8, blockbits: 2,
      accesses: ["00000000", "00000100", "00001000", "00001100", "00000001", "00010000", "00000101"] });
    expect(types(sim)).to.deep.equal(["miss", "miss", "miss", "miss", "hit", "miss", "miss"]);
    expect(sim.results.cache.map(line => line.data)).to.deep.equal([0, 4, 1, 3]);
    expect(sim.results.actions[0].state).to.deep.equal(Array(4).fill({ valid: false }));
    expect(sim.results.actions[1].state[0].data).to.equal(0);
  });

  it("allows all generated hits with initial residents and preserves their data", () => {
    const initial = coldEntries(2);
    initial[1] = { valid: true, tag: "001", data: 777 };
    const sim = generated({ blocks: 2, ways: 2, membits: 5, blockbits: 2, initial, accesses: 5, hits: 5 });
    expect(types(sim)).to.deep.equal(Array(5).fill("hit"));
    expect(sim.hitCount).to.equal(5);
    expect(sim.missCount).to.equal(0);
    expect(sim.results.cache[1].data).to.equal(777);
  });

  it("generates deterministic exact and bounded hits with distinct miss tags and feasible sets", () => {
    for (let seed = 0; seed < 24; seed++) {
      const sim = generated({ seed });
      expect(generated({ seed: String(seed) })).to.deep.equal(sim);
      expect(sim.hitCount).to.equal(3);
      expect(sim.missCount).to.equal(5);
      expect(sim.trace[0].expected).to.equal("miss");
      expect(new Set(sim.trace.filter(row => row.expected === "miss").map(row => row.tag)).size).to.equal(5);
      expect(sim.setCount).to.equal(4);
      const bounded = generated({ seed, hits: undefined, minHits: 2, maxHits: 4 });
      expect(bounded.hitCount).to.be.within(2, 4);
    }
  });

  it("changes the previous offset of each resident block on every generated hit", () => {
    for (let seed = 0; seed < 12; seed++) {
      const sim = generated({ seed, ways: 4, accesses: 16, hits: 12, blockbits: 1 });
      const previous = new Map();
      for (const row of sim.trace) {
        if (row.expected === "hit") expect(row.offset).not.to.equal(previous.get(row.blockNumber));
        previous.set(row.blockNumber, row.offset);
      }
    }
    const bytes = generated({ blocks: 2, ways: 2, blockbits: 0 });
    expect(bytes.trace.every(row => row.offset === 0 && row.offsetBits === "")).to.equal(true);
  });

  it("guarantees minimum full-set conflicts while retaining all feasible set variety", () => {
    for (const ways of [1, 2, 4]) {
      for (let seed = 0; seed < 12; seed++) {
        const misses = ways + 2 + (4 / ways - 1);
        const sim = generated({ ways, seed, accesses: misses + 3, hits: 3, conflicts: 2 });
        expect(sim.hitCount).to.equal(3);
        expect(sim.conflictCount).to.be.at.least(2);
        expect(sim.setCount).to.equal(4 / ways);
        expect(new Set(sim.trace.filter(row => row.expected === "miss").map(row => row.tag)).size).to.equal(misses);
      }
    }
  });

  it("uses initial occupancy in conflict and hit feasibility budgets", () => {
    const initial = [
      { valid: true, tag: "000", data: 111 },
      { valid: true, tag: "001", data: 222 }
    ];
    const sim = generated({ blocks: 2, ways: 2, membits: 5, blockbits: 2, initial, accesses: 4, hits: 2, conflicts: 2 });
    expect(sim.conflictCount).to.equal(2);
    expect(sim.hitCount).to.equal(2);
    const bounded = generated({ ways: 4, accesses: 6, hits: undefined, minHits: 0, maxHits: 5, conflicts: 2 });
    expect(bounded.hitCount).to.equal(0);
    expect(bounded.conflictCount).to.equal(2);
  });

  it("handles finite tag spaces without retry failures and rejects exhausted-memory miss targets", () => {
    const sim = generated({ blocks: 2, ways: 2, membits: 2, blockbits: 1, accesses: 7, hits: undefined });
    expect(sim.missCount).to.be.within(1, 2);
    expect(sim.hitCount).to.equal(7 - sim.missCount);
    expect(sim.conflictCount).to.equal(0);
    rejects({ blocks: 2, ways: 2, membits: 2, blockbits: 1, accesses: 3, hits: 0 });
    rejects({ blocks: 2, ways: 2, membits: 2, blockbits: 1, accesses: 3, conflicts: 1 });
  });

  it("rejects impossible hit and conflict constraints rather than weakening them", () => {
    [
      { accesses: 1, hits: 1 }, { accesses: 4, hits: 4 },
      { accesses: 4, minHits: 3, maxHits: 2 }, { hits: -1 }, { maxHits: 99 },
      { ways: 4, accesses: 5, hits: 1, conflicts: 1 },
      { ways: 2, accesses: 4, hits: 1, conflicts: 2 }, { conflicts: -1 }
    ].forEach(overrides => rejects(Object.assign({ seed: 0, membits: 10, blockbits: 2 }, overrides)));
  });

  it("rejects malformed geometry, fractional or partial integers, addresses and explicit-trace constraints", () => {
    [
      { blocks: 3 }, { blocks: 0 }, { blocks: 2, ways: 4 }, { ways: 3 }, { ways: 0 },
      { membits: 2, blockbits: 2 }, { blockbits: -1 }, { membits: 53 },
      { blocks: 4, ways: 4, membits: 2, blockbits: 1 },
      { accesses: 0 }, { accesses: 1.5 }, { accesses: "2tail" }, { accesses: "1.5" },
      { ways: 1.5 }, { blocks: "4x" }, { membits: NaN }, { blockbits: Infinity },
      { hits: 1.5 }, { minHits: 0.5 }, { maxHits: 2.5 }, { conflicts: 0.5 },
      { accesses: [] }, { accesses: ["00000000"] },
      { membits: 8, blockbits: 2, accesses: ["0000000"] },
      { membits: 8, blockbits: 2, accesses: ["0000000x"] },
      { membits: 8, blockbits: 2, accesses: [0] },
      ...["hits", "minHits", "maxHits", "conflicts"].map(key => ({ membits: 8, blockbits: 2, accesses: ["00000000"], [key]: 0 })),
      { initial: [] }, { initial: [{ valid: 1, tag: "0", data: 0 }] },
      { ways: 4, membits: 6, blockbits: 2, initial: Array(4).fill({ valid: true, tag: "0000", data: 0 }) },
      { initial: Array(4).fill({ valid: false, tag: "x", data: 0 }) },
      { initial: Array(4).fill({ valid: false, tag: "0", data: 1.5 }) },
      { ways: 1, membits: 8, blockbits: 2, initial: Array(4).fill({ valid: true, tag: "0", data: 0 }) }
    ].forEach(rejects);
  });

  it("does not truncate fractional config options or accept fractional powers of two", () => {
    for (const opts of [{ membits: 12.5 }, { blockbits: "2.5" }, { ways: 1.5 }, { indexbits: "2x" }]) {
      let failure;
      try { generateConfig(opts); } catch (error) { failure = error; }
      expect(failure).not.to.equal(undefined);
    }
    let failure;
    try { log2Exact("ways", 0.5); } catch (error) { failure = error; }
    expect(failure).not.to.equal(undefined);
  });
});
