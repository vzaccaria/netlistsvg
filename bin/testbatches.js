/*eslint quotes: [0] */

let fsmTestBatch = {
  name: "vz-fsm",
  scriptname: `${__dirname}/vz-fsm.js`,
  fixtures: `${__dirname}/fixtures`,
  tests: [
    {
      msg: `three states moore machine`,
      cmd: (s, fd) => `${s} ${fd}/moore.json`
    },
    {
      msg: `three states mealy machine`,
      cmd: (s, fd) => `${s} ${fd}/mealy.json`
    }
  ]
};

let quineTestBatch = {
  name: "vz-quine",
  scriptname: `${__dirname}/vz-quine.js`,
  fixtures: `${__dirname}/fixtures`,
  tests: [
    {
      msg: `with dont cares`,
      cmd: s => `${s} "101011100x111111"`
    }
  ]
};

let pipeTestBatch = {
  name: "vz-pipe",
  scriptname: `${__dirname}/vz-pipe.js`,
  fixtures: `${__dirname}/fixtures`,
  tests: [
    {
      msg: `load and add`,
      cmd: s => `${s} pipesim 'lw(2)(1),add(4)(2)(5)' -c cw0d1,fe0e1`
    }
  ]
};

module.exports = [fsmTestBatch, quineTestBatch, pipeTestBatch];
