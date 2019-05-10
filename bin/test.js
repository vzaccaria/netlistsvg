/*eslint quotes: [0] */

var chai = require("chai");
chai.use(require("chai-as-promised"));
var should = chai.should();

const { exec } = require("mz/child_process");
const $fs = require("mz/fs");
const _ = require("lodash");
const batches = require("./testbatches");
/**
 * Promised version of shelljs exec
 * @param  {string} cmd The command to be executed
 * @return {promise}     A promise for the command output
 */

/*global describe, it */

let parse = x => {
  x = JSON.parse(x);
  x.latex = _.map(x.latex, i => {
    delete i.addoptions;
    return i;
  });
  return x;
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
          .then(parse)
          .should.eventually.deep.equal(parse(f));
      });
    });
  });
};

_.map(batches, testBatch);
