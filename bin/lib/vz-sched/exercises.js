"use strict";

const path = require("path");
const { generateModel } = require("./model");
const collection = require("../exercise-collection")("sched");
const { fail, shellQuote } = collection;

function generatedEntry(id, schedule, manifestRoot, assetName) {
  let model;
  try { model = generateModel(schedule); }
  catch (error) { fail(`${id}.generate: ${error.message || error}`); }
  const filename = `${assetName}.json`;
  return {
    values: model.values,
    entry: {
      inputs: { [filename]: schedule },
      vars: {
        input: shellQuote(path.join(manifestRoot, id, filename)),
        prefix: shellQuote(path.join(manifestRoot, id, "assets", assetName))
      },
      steps: ["vzpac sched {input} -c -s {prefix}"]
    }
  };
}

function generate(input, output, manifest) {
  return collection.generate(input, output, manifest, generatedEntry);
}

module.exports = { generate };
