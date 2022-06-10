let _ = require("lodash");
let nofw = [
  "lw(1)(10),sub(2)(1)(12),add(13)(1)(2)",
  "add(1)(10)(12),sub(3)(4)(12),add(13)(1)(2)",
  "add(1)(10)(12),beq(1)(2),add(3)(1)(2)",
  "add(2)(9)(10),beq(2)(1),add(2)(9)(10),beq(2)(1),add(2)(9)(10),beq(2)(1)",
  "lw(1)(3),sub(2)(1)(10),beq(2)(5),lw(1)(3),sub(2)(1)(10),beq(2)(5)",
  "lw(1)(10),sw(1)(11),add(13)(1)(2)",
  "lw(1)(10),sw(3)(1),add(13)(1)(2)"
];

let fw = [
  "lw(1)(10),sub(2)(1)(12),add(13)(1)(2)",
  "lw(1)(10),sw(2)(11),add(13)(1)(2)",
  "add(1)(10)(12),beq(1)(2),add(3)(1)(2)",
  "lw(1)(10),sw(1)(11),add(13)(1)(2)",
  "lw(1)(10),sw(3)(1),add(13)(1)(2)"
];

let fwbo = [
  "lw(1)(2),sw(1)(3),sub(4)(4)(5),add(2)(2)(4),add(3)(3)(4),beq(4)(6)",
  "add(1)(10)(12),beq(1)(2),add(3)(1)(2)",
  "lw(1)(3),sub(2)(1)(10),beq(2)(5),lw(1)(3),sub(2)(1)(10),beq(2)(5)",
  "lw(1)(3),beq(1)(5),lw(2)(3),add(3)(3)(3)"
];

let bo = [
  "lw(1)(2),sw(1)(3),sub(4)(4)(5),add(2)(2)(4),add(3)(3)(4),beq(4)(6),lw(1)(2),sw(1)(3),sub(4)(4)(5),add(2)(2)(4),add(3)(3)(4),beq(4)(6)",
  "add(1)(10)(12),beq(1)(2),add(3)(1)(2)",
  "lw(1)(3),beq(1)(5),lw(2)(3),add(3)(3)(3)"
];

let fixtures = _.flatten([
  _.map(nofw, p => {
    return { desc: "No fw", program: p, options: { debug: true } };
  }),
  _.map(fw, p => {
    return { desc: "Fw", program: p, options: { fw: true, debug: true } };
  }),
  _.map(fwbo, p => {
    return {
      desc: "Fw BranchOpt",
      program: p,
      options: { fw: true, branchopt: true, debug: true }
    };
  }),
  _.map(bo, p => {
    return {
      desc: "BranchOpt",
      program: p,
      options: { branchopt: true, debug: true }
    };
  })
]);

module.exports = { fixtures };
