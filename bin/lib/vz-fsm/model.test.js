"use strict";

/* global describe, it */
const { expect } = require("chai");
const { generateModel } = require("./model");

function machine() {
  return { type: "mealy", inputSize: 1, outputSize: 1,
    transitions: [{ a: [{ a: [0] }, { "b/b280": [1] }] }, { b: [{ c: [1] }, { a: [0] }] }, { c: [{ b: [0] }, { c: [1] }] }],
    encodingSize: 2, encoding: { a: [0, 0], b: [0, 1], c: [1, 1] } };
}
function rows(model, suffix) {
  const artifact = model.artifacts.find(item => item.sfx === suffix);
  return artifact.code.split("\n").filter(line => /^\s*[01x] &/.test(line))
    .map(line => line.replace(/\\\\\s*$/, "").trim().split(/\s*&\s*/));
}

describe("native FSM exercise model", () => {
  it("keeps unused codes don't-care and all four excitation families consistent with next-state bits", () => {
    const model = generateModel({ fsm: machine(), flipFlop: "SR" });
    const next = rows(model, "transition-table");
    const d = rows(model, "d-excitation-table"), sr = rows(model, "sr-excitation-table");
    const t = rows(model, "t-excitation-table"), jk = rows(model, "jk-excitation-table");
    expect(next).to.deep.equal([
      ["0", "0", "0", "0", "0"], ["0", "0", "1", "0", "1"],
      ["0", "1", "0", "1", "1"], ["0", "1", "1", "0", "0"],
      ["1", "0", "0", "x", "x"], ["1", "0", "1", "x", "x"],
      ["1", "1", "0", "0", "1"], ["1", "1", "1", "1", "1"]
    ]);
    for (let row = 0; row < next.length; row++) for (let bit = 0; bit < 2; bit++) {
      const before = next[row][bit], after = next[row][3 + bit];
      expect(d[row][3 + bit]).to.equal(after);
      if (after === "x") {
        expect(t[row][3 + bit]).to.equal("x");
        expect(sr[row].slice(3 + 2 * bit, 5 + 2 * bit)).to.deep.equal(["x", "x"]);
        expect(jk[row].slice(3 + 2 * bit, 5 + 2 * bit)).to.deep.equal(["x", "x"]);
      } else {
        expect(Number(t[row][3 + bit]) ^ Number(before)).to.equal(Number(after));
        const [s, r] = sr[row].slice(3 + 2 * bit, 5 + 2 * bit);
        const [j, k] = jk[row].slice(3 + 2 * bit, 5 + 2 * bit);
        for (const dc of [0, 1]) {
          const bitValue = value => value === "x" ? dc : Number(value);
          expect(bitValue(s) & bitValue(r)).to.equal(0);
          expect(bitValue(s) | (Number(before) & (1 - bitValue(r)))).to.equal(Number(after));
          expect((bitValue(j) & (1 - Number(before))) | ((1 - bitValue(k)) & Number(before))).to.equal(Number(after));
        }
      }
    }
    expect(rows(model, "output-table").map(row => row[3])).to.deep.equal(["0", "1", "1", "0", "x", "x", "0", "1"]);
  });

  it("derives updated next-state/output tables from changed transitions and state encoding", () => {
    const fsm = machine();
    fsm.transitions[0].a[1] = { "c/b280": [0] };
    fsm.encoding = { a: [1, 0], b: [0, 0], c: [0, 1] };
    const model = generateModel({ fsm, flipFlop: "T" });
    expect(rows(model, "transition-table")[5]).to.deep.equal(["1", "0", "1", "0", "1"]);
    expect(rows(model, "output-table")[5]).to.deep.equal(["1", "0", "1", "0"]);
    expect(rows(model, "t-excitation-table")[5]).to.deep.equal(["1", "0", "1", "1", "1"]);
    expect(model.values.encodingLatex).to.equal("a=10,\\; b=00,\\; c=01");
    expect(model.values.stateTableMarkdown).to.include("| $a$ | $a/0$ | $c/0$ |");
  });

  it("uses Moore state outputs independently of input words", () => {
    const fsm = { type: "moore", inputSize: 1, outputSize: 1, transitions: [{ a: ["a", "b"] }, { b: ["a", "b"] }], output: [[1], [0]], encodingSize: 1, encoding: { a: [0], b: [1] } };
    expect(rows(generateModel({ fsm }), "output-table")).to.deep.equal([["0", "1"], ["1", "0"]]);
  });

  it("renders draw-only machines without an initial state or encoding and retains native routing", () => {
    const fsm = machine();
    delete fsm.encoding;
    delete fsm.encodingSize;
    const model = generateModel({ fsm, draw: true });
    expect(model.artifacts.map(item => item.sfx)).to.deep.equal(["diagram"]);
    expect(model.artifacts[0].code).to.include("bend left=280");
    expect(model.artifacts[0].code).not.to.include("state,initial");
    expect(model.values).not.to.have.property("encodingLatex");
    expect(() => generateModel({ fsm })).to.throw(/encodingSize/);
  });

  it("rejects dangling states, incomplete transitions, invalid bits and encoding collisions before synthesis", () => {
    const cases = [
      [fsm => { fsm.initial = "missing"; }, /initial: unknown state/],
      [fsm => { fsm.transitions[0].a[1] = { absent: [0] }; }, /unknown destination/],
      [fsm => { fsm.transitions[0].a.pop(); }, /expected 2 transitions/],
      [fsm => { fsm.transitions[0].a[0].a = [2]; }, /numeric bits/],
      [fsm => { fsm.encoding.c = [0, 0]; }, /duplicate code/],
      [fsm => { fsm.encodingSize = 6; }, /between 1 and 5/],
      [fsm => { fsm.inputSize = 20; }, /between 1 and 4/]
    ];
    for (const [change, message] of cases) {
      const fsm = machine(); change(fsm);
      expect(() => generateModel({ fsm })).to.throw(message);
    }
  });
});
