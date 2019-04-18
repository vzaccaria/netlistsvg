/*eslint quotes: [0] */

const { exec } = require("mz/child_process");
const $fs = require("mz/fs");
const _ = require("lodash");
const batches = require("./testbatches");
const { compileArtifacts } = require("./lib/artifacts");

let compileBatch = b => {
  _.map(b.tests, j => {
    let fd = b.fixtures;
    let expected = `${fd}/ref-${b.name}-${_.kebabCase(j.msg)}.json`;

    let f = $fs.readFileSync(expected, "utf8");
    f = JSON.parse(f);
    compileArtifacts(
      f.latex,
      `fixtures/artifacts/${b.name}-${_.kebabCase(j.msg)}`
    );
  });
};

_.map(batches, compileBatch);
