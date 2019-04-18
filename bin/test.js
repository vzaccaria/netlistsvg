/*eslint quotes: [0] */

var chai = require("chai");
chai.use(require("chai-as-promised"));
var should = chai.should();

const { exec } = require("mz/child_process");
const $fs = require("mz/fs");
const _ = require("lodash");
/**
 * Promised version of shelljs exec
 * @param  {string} cmd The command to be executed
 * @return {promise}     A promise for the command output
 */

/*global describe, it */

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

let testBatch = b => {
  describe(b.name, () => {
    // The following line is temporary, remove it!!!
    //  jsonTest = [_.last(jsonTest)];
    _.map(b.tests, j => {
      let s = b.scriptname;
      let fd = b.fixtures;
      let expected = `${fd}/ref-${b.name}-${_.kebabCase(j.msg)}.json`;
      let q = j;
      it(`should ${q.msg} [ rm -f ${expected} && ${q.cmd(
        s,
        fd
      )} > ${expected} ] `, () => {
        let f = $fs.readFileSync(expected, "utf8");
        return exec(q.cmd(s, fd))
          .then(a => a[0])
          .then(JSON.parse)
          .should.eventually.deep.equal(JSON.parse(f));
      });
    });
  });
};

testBatch(fsmTestBatch);
testBatch(quineTestBatch);
testBatch(pipeTestBatch);
