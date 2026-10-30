"use strict";

const yaml = require("js-yaml");
const { generateModel } = require("./model");
const collection = require("../exercise-collection")("isa");

function generatedEntry(id, raw) {
  let model;
  try { model = generateModel(raw); }
  catch (error) { collection.fail(`${id}.generate: ${error.message || error}`); }
  const inputs = {
    "fragments.yml": yaml.dump(Object.fromEntries(Object.keys(raw.fragments || {}).map(name => [name, model.values[name]])), { lineWidth: -1, noRefs: true }),
    "verification.yml": yaml.dump(model.evidence, { lineWidth: -1, noRefs: true })
  };
  for (const name of Object.keys(raw.fragments || {})) model.values[name] = model.values[name].replace(/\r?\n$/, "");
  for (const item of model.cases) {
    for (const [name, source] of Object.entries(item.sources)) inputs[`${item.name}-${name}`] = source;
  }
  return { values: model.values, entry: { manual: true, inputs } };
}

function generate(input, output, manifest) {
  return collection.generate(input, output, manifest, generatedEntry);
}

function register(prog) {
  prog.command("isa exercises", "Verify native C/RISC-V cases and generate ISA exercise collections")
    .argument("<yml>", "ISA instances YAML (paths are relative to this file)")
    .option("-o, --output <markdown>", "Generated Markdown chapter", undefined, undefined, true)
    .option("--manifest <yml>", "Native source and verification manifest", undefined, undefined, true)
    .action((args, options) => generate(args.yml, options.output, options.manifest));
}

module.exports = { register, generate };
