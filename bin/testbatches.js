/*eslint quotes: [0] */

let fsmTestBatch = {
  name: "vz-fsm",
  scriptname: `${__dirname}/vz-fsm.js`,
  fixtures: `${__dirname}/fixtures/fsm`,
  tests: [
    {
      msg: `three states moore machine`,
      cmd: (s, fd) => `${s} ${fd}/src/moore.json`
    },
    {
      msg: `four states moore machine (te 20160504)`,
      cmd: (s, fd) => `${s} ${fd}/src/moore20160504.json`
    },
    {
      msg: "seven states moore machine (te 20150504)",
      cmd: (s, fd) => `${s} ${fd}/src/moore20150504.json`
    },
    {
      msg: `three states mealy machine`,
      cmd: (s, fd) => `${s} ${fd}/src/mealy.json`
    },
    {
      msg: `three states mealy machine (te 20180726)`,
      cmd: (s, fd) => `${s} ${fd}/src/mealy20180726.json`
    }
  ]
};

let quineTestBatch = {
  name: "vz-quine",
  scriptname: `${__dirname}/vz-quine.js`,
  fixtures: `${__dirname}/fixtures/quine`,
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

let rvfcallTestBatch = {
  name: "vz-rv-fcall",
  scriptname: `${__dirname}/vz-rv-fcall.js`,
  fixtures: `${__dirname}/fixtures/riscv`,
  tests: [
    {
      msg: `two parameters`,
      cmd: (s, fd) => `${s} artifact ${fd}/rv-rec-2par/rv-fun-spec.json`
    },
    {
      msg: `complex parameters`,
      cmd: (s, fd) => `${s} artifact ${fd}/rv-rec-complex/rv-fun-spec.json`
    }
  ]
};

let mmapTestBatch = {
  name: "vz-memmap",
  scriptname: `${__dirname}/vz-memmap.js`,
  fixtures: `${__dirname}/fixtures/memmap`,
  tests: [
    {
      msg: `simple memmap`,
      cmd: (s, fd) => `${s} generate ${fd}/src/memmap.csv`
    }
  ]
};

let pipeTestBatch = {
  name: "vz-pipe",
  scriptname: `${__dirname}/vz-pipe.js`,
  fixtures: `${__dirname}/fixtures/pipe`,
  tests: [
    {
      msg: `load and add`,
      cmd: s => `${s} pipesim 'lw(2)(1),add(4)(2)(5)' -c cw0d1,fe0e1`
    },
    {
      msg: "branch",
      cmd: s =>
        `${s} pipesim 'add(2)(9)(10),anything(),beq(2)(1),anything(),anything()' -c cw0d2,cm2i3 --alufw --branchopt`
    }
  ]
};

let waveTestBatch = {
  name: "vz-wave",
  scriptname: `${__dirname}/vz-wave.js`,
  fixtures: `${__dirname}/fixtures/wave`,
  tests: [
    {
      msg: `parse vcd`,
      cmd: (s, fd) =>
        `${s} -n -c -s test.i,test.z,test.dut.d1,test.dut.q1,test.dut.d2,test.dut.q2,test.clk,test.rst --end 28 -w I,CLK ${fd}/src/wave.vcd`
    },
    {
      msg: `parse wavedrom`,
      cmd: (s, fd) => `${s} ${fd}/src/wave.json`
    }
  ]
};

let cacheTestBatch = {
  name: "vz-cache",
  scriptname: `${__dirname}/vz-cache.js`,
  fixtures: `${__dirname}/fixtures/cache`,
  tests: [
    {
      msg: `test raw trace generation`,
      cmd: s =>
        `${s} sim '100110 0101 0010, 101101 0000 0001, 000011 1010 0100, 101101 1100 1101, 101001 1110 0111, 001100 0101 1100' -e '1,101,20,0,000,1,0,100,18,1,001,7'`
    },
    {
      msg: `test raw trace generation - no empty cache`,
      cmd: s =>
        `${s} sim '100110 0101 0010, 101101 0000 0001, 000011 1010 0100, 101101 1100 1101, 101001 1110 0111, 001100 0101 1100' `
    },
    {
      msg: `test raw trace generation - 2^8 cache block size`,
      cmd: s =>
        `${s} sim '100110 0101 0010, 101101 0000 0001, 000011 1010 0100, 101101 1100 1101, 101001 1110 0111, 001100 0101 1100' -b 8`
    },
    {
      msg: `test raw trace generation - 2^10 cache block size`,
      cmd: s =>
        `${s} sim '100110 0101 0010, 101101 0000 0001, 000011 1010 0100, 101101 1100 1101, 101001 1110 0111, 001100 0101 1100' -b 10`
    },
    {
      msg: `test raw trace generation - 2way - 2^13 cache block size`,
      cmd: s =>
        `${s} sim '0101110111000111110, 1101000001110101011, 0011101111100000110, 0011111011101010101, 0000000000000000000, 0101110101011111100' -e '0,11010,52,1,01011,22,0,11011,55,1,00111,15' -b 13 -w 1 -s 15 -m 19`
    }
  ]
};

module.exports = [
  fsmTestBatch,
  quineTestBatch,
  pipeTestBatch,
  waveTestBatch,
  rvfcallTestBatch,
  cacheTestBatch
];
