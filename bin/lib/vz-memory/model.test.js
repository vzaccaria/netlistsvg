"use strict";

/* global describe, it */
const { expect } = require("chai");
const { generateModel } = require("./model");
const latency = { kind: "latency", eta: 4, nu: 100, unit: "ns", target: "cacheless", relation: "le" };
const address = { kind: "address", memoryBytes: 4294967296, cacheBytes: 1024, wordBits: 32, blockBytes: 32 };
const values = options => generateModel(options).values;

describe("quantitative memory model", () => {
  it("preserves historical thresholds without floating point display artifacts", () => {
    expect(values(latency)).to.include({ eta: 4, nu: 100, target: 100, threshold: 0.04, operator: "\\le", hitOperator: "\\ge" });
    expect(values(Object.assign({}, latency, { target: 5 })).threshold).to.equal(0.99);
    expect(values(Object.assign({}, latency, { eta: 0.1, nu: 0.2, target: 0.2 })).threshold).to.equal(0.5);
    expect(values(Object.assign({}, latency, { eta: 9, nu: 60, target: 21 })).threshold).to.equal(0.8);
  });

  for (const [relation, operator, hitOperator] of [
    ["le", "\\le", "\\ge"], ["lt", "<", ">"], ["ge", "\\ge", "\\le"], ["gt", ">", "<"]
  ]) {
    it(`reverses ${relation} without changing strictness at physical boundaries`, () => {
      for (const [target, threshold] of [[4, 1], [104, 0], [0, 1.04], [204, -1]]) {
        expect(values(Object.assign({}, latency, { target, relation }))).to.include({ threshold, operator, hitOperator, rhoDomain: "0 \\le \\rho \\le 1" });
      }
    });
  }

  it("does not erase a cache cost smaller than the main-memory latency precision", () => {
    const threshold = values(Object.assign({}, latency, { eta: 1e-20 })).threshold;
    expect(threshold).to.be.greaterThan(0);
    expect(threshold).to.be.lessThan(1e-21);
  });

  it("derives the historical 32-block geometry and identical diagram widths", () => {
    const model = generateModel(address);
    expect(model.values).to.deep.equal({
      memoryBytes: 4294967296, cacheBytes: 1024, wordBits: 32, blockBytes: 32,
      memorySize: "4GiB", cacheSize: "1KiB", membits: 32, blockbits: 5,
      indexbits: 5, tagbits: 22, blocks: 32, wordsPerBlock: 8
    });
    expect(model.wave).to.deep.equal([{ name: "bo", bits: 5 }, { name: "ixc", bits: 5 }, { name: "tag", bits: 22 }]);
  });

  it("supports changed parameters and single-block, single-byte boundaries", () => {
    expect(values(Object.assign({}, address, { memoryBytes: 65536, cacheBytes: 2048, blockBytes: 64, wordBits: 64 })))
      .to.include({ memorySize: "64KiB", cacheSize: "2KiB", membits: 16, blockbits: 6, indexbits: 5, tagbits: 5, blocks: 32, wordsPerBlock: 8 });
    expect(generateModel({ kind: "address", memoryBytes: 2, cacheBytes: 1, blockBytes: 1, wordBits: 8 }))
      .to.deep.equal({ values: { memoryBytes: 2, cacheBytes: 1, blockBytes: 1, wordBits: 8,
        memorySize: "2B", cacheSize: "1B", membits: 1, blockbits: 0, indexbits: 0, tagbits: 1, blocks: 1, wordsPerBlock: 1 },
      wave: [{ name: "bo", bits: 0 }, { name: "ixc", bits: 0 }, { name: "tag", bits: 1 }] });
  });


  for (const input of [null, [], {},
    ...[{ extra: 1 }, { eta: -1 }, { nu: 0 }, { target: "5" }, { target: Infinity },
      { relation: "eq" }, { unit: " " }, { eta: NaN }].map(change => Object.assign({}, latency, change)),
    ...[{ memoryBytes: 4000 }, { cacheBytes: 8192, memoryBytes: 4096 },
      { blockBytes: 2048 }, { wordBits: 7 }, { wordBits: 24 }, { wordBits: 512 },
      { cacheBytes: address.memoryBytes }, { extra: true }].map(change => Object.assign({}, address, change))
  ]) {
    it(`rejects invalid options ${JSON.stringify(input)}`, () => expect(() => generateModel(input)).to.throw());
  }
});
