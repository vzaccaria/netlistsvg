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
      msg: `generate valid json for a moore machine`,
      cmd: (s, fd) => `${s} ${fd}/moore.json`,
      expected: fd => `${fd}/fsm-expected-output-moore.json`
    },
    {
      msg: `generate valid json for a mealy machine`,
      cmd: (s, fd) => `${s} ${fd}/mealy.json`,
      expected: fd => `${fd}/fsm-expected-output-mealy.json`
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
      cmd: (s, fd) => `${s} "001000000x000111"`,
      expected: fd => `${fd}/quine-expected-output-with-dont-cares.json`
    }
  ]
};

// vz-quine "001000000x000111"

let testBatch = b => {
  describe(b.name, () => {
    // The following line is temporary, remove it!!!
    //  jsonTest = [_.last(jsonTest)];
    _.map(b.tests, j => {
      let s = b.scriptname;
      let fd = b.fixtures;
      let q = j;
      it(`should ${q.msg} [ rm -f ${q.expected(fd)} && ${q.cmd(
        s,
        fd
      )} > ${q.expected(fd)} ] `, () => {
        let f = $fs.readFileSync(q.expected(fd), "utf8");
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
