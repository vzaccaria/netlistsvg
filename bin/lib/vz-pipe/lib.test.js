/* global it */
const { expect } = require("chai");
const { run } = require("./lib");

it("interlocks both dependent arithmetic instructions without forwarding", () => {
  const result = run({}, "lw(1)(10),sub(2)(1)(12),add(13)(1)(2)");
  expect(result.table.map(row => row.n_we)).to.deep.equal([4, 7, 10]);
  expect(result.table.map(row => row.ins)).to.deep.equal([
    "lw x1, lab(x10)", "sub x2, x1, x12", "add x13, x1, x2"
  ]);
});

it("forwards an ALU result but retains the load-use interlock", () => {
  const result = run({ fw: true }, "lw(1,10),sub(2,1,12),add(13,1,2)");
  expect(result.table.map(row => row.n_we)).to.deep.equal([4, 6, 7]);
});
