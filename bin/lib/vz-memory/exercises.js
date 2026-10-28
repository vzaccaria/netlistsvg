"use strict";

const path = require("path");
const { generateModel } = require("./model");
const collection = require("../exercise-collection")("memory");

function generatedEntry(id, raw, manifestRoot, assetName) {
  if (raw && raw.kind === "cache") {
    const options = Object.assign({}, raw);
    delete options.kind;
    return require("../vz-cache/exercises").generatedEntry(id, options, manifestRoot, assetName);
  }
  let model;
  try {
    model = generateModel(raw);
  } catch (error) {
    collection.fail(`${id}.generate: ${error.message || error}`);
  }
  if (!model.wave) return { values: model.values, entry: { manual: true } };
  return {
    values: model.values,
    entry: {
      vars: { qdir: collection.shellQuote(path.join(manifestRoot, id)) },
      inputs: { "wave.json": model.wave },
      steps: [`vzpac wave {qdir}/wave.json -r -d {qdir}/assets/${assetName}.pdf`]
    }
  };
}

function generate(input, output, manifest) {
  return collection.generate(input, output, manifest, generatedEntry);
}

function register(prog) {
  prog.command("memory exercises", "Generate memory exercises and their asset manifest")
    .argument("<yml>", "Memory instances YAML (paths are relative to this file)")
    .option("-o, --output <markdown>", "Generated Markdown chapter", undefined, undefined, true)
    .option("--manifest <yml>", "Combined gen-assets YAML", undefined, undefined, true)
    .action((args, options) => generate(args.yml, options.output, options.manifest));
}

module.exports = { register, generate };
