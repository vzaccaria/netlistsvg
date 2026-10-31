"use strict";

const path = require("path");
const yaml = require("js-yaml");
const { generateModel } = require("./model");
const collection = require("../exercise-collection")("rv-fcall");

function generatedEntry(id, raw, manifestRoot) {
  let model;
  try { model = generateModel(raw); }
  catch (error) { collection.fail(`${id}.generate: ${error.message || error}`); }
  const directory = path.join(manifestRoot, id);
  const layout = Object.assign({}, raw.layout, {
    functionData: Object.assign({}, raw.layout.functionData, {
      body: "$selfdir/body.s", cref: "$selfdir/source.c"
    })
  });
  const inputs = {
    "input.json": JSON.stringify(layout, null, 2) + "\n",
    "body.s": raw.body,
    "source.c": raw.source,
    "full.s": model.values.full,
    "prologue.s": model.values.prologue,
    "epilogue.s": model.values.epilogue,
    "empty.s": model.values.empty,
    "verification.yml": yaml.dump(model.evidence, { lineWidth: -1, noRefs: true })
  };
  for (const item of model.cases) {
    for (const [name, source] of Object.entries(item.sources)) inputs[`${item.name}-${name}`] = source;
  }
  return {
    values: model.values,
    entry: {
      vars: { qdir: collection.shellQuote(directory) },
      inputs,
      steps: ["vzpac rv-fcall artifact {qdir}/input.json -c -s {qdir}/assets/rv-fun"]
    },
    assetPaths: { nativeAssets: path.join(directory, "assets", "rv-fun") }
  };
}

function generate(input, output, manifest) {
  return collection.generate(input, output, manifest, generatedEntry);
}

function register(prog) {
  prog.command("rv-fcall exercises", "Verify native function calls and generate inline collections with native stack artifacts")
    .argument("<yml>", "Function-call instances YAML (paths are relative to this file)")
    .option("-o, --output <markdown>", "Generated Markdown chapter", undefined, undefined, true)
    .option("--manifest <yml>", "Native artifact and verification manifest", undefined, undefined, true)
    .action((args, options) => generate(args.yml, options.output, options.manifest));
}

module.exports = { register, generate };
