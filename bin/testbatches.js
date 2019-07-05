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
      msg: "seven states moore machine (te 20150504)",
      cmd: (s, fd) => `${s} ${fd}/moore20150504.json`
    },
    {
      msg: `three states mealy machine`,
      cmd: (s, fd) => `${s} ${fd}/mealy.json`
    },
    {
      msg: `three states mealy machine (te 20180726)`,
      cmd: (s, fd) => `${s} ${fd}/mealy20180726.json`
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
    },
    {
      msg: `should be zero`,
      cmd: s => `${s} "xx00xxxxxxxxxxxx"`
    },
    {
      msg: `should be one`,
      cmd: s => `${s} "xx11xxxxxxxxxxxx"`
    }
  ]
};

let fcallTestBatch = {
  name: "vz-fcall",
  scriptname: `${__dirname}/vz-fcall.js`,
  fixtures: `${__dirname}/fixtures`,
  tests: [
    {
      msg: `array parameters`,
      cmd: (s, fd) => `${s} artifact ${fd}/mipsfcall.json`
    },
    {
      msg: `tema esame 1`,
      cmd: (s, fd) => `${s} artifact ${fd}/mipsfcall1.json`
    },
    {
      msg: `ricorsiva`,
      cmd: (s, fd) => `${s} artifact ${fd}/mipsfcallrec.json`
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

let cacheTestBatch = {
  name: "vz-cache",
  scriptname: `${__dirname}/vz-cache.js`,
  fixtures: `${__dirname}/fixtures`,
  tests: [
    {
      msg: `test raw trace generation`,
      cmd: s =>
        `${s} sim '100110 0101 0010, 101101 0000 0001, 000011 1010 0100, 101101 1100 1101, 101001 1110 0111, 001100 0101 1100' -e '1,101,20,0,000,1,0,100,18,1,001,7'`
    }
  ]
};

module.exports = [
  fsmTestBatch,
  quineTestBatch,
  pipeTestBatch,
  waveTestBatch,
  fcallTestBatch,
  cacheTestBatch
];
