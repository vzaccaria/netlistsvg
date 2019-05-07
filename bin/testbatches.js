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
      msg: `four states moore machine (te 20160504)`,
      cmd: (s, fd) => `${s} ${fd}/moore20160504.json`
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

let waveTestBatch = {
  name: "vz-wave",
  scriptname: `${__dirname}/vz-wave.js`,
  fixtures: `${__dirname}/fixtures`,
  tests: [
    {
      msg: `parse vcd`,
      cmd: (s, fd) =>
        `${s} -n -c -s test.i,test.z,test.dut.d1,test.dut.q1,test.dut.d2,test.dut.q2,test.clk,test.rst --end 28 -w I,CLK ${fd}/wave.vcd`
    },
    {
      msg: `parse wavedrom`,
      cmd: (s, fd) => `${s} ${fd}/wave.json`
    }
  ]
};

module.exports = [fsmTestBatch, quineTestBatch, pipeTestBatch, waveTestBatch];
