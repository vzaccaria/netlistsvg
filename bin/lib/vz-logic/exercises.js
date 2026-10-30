"use strict";

const path = require("path");
const { generateModel } = require("./model");
const collection = require("../exercise-collection")("logic");

function generatedEntry(id, raw, manifestRoot, assetName) {
  let model;
  try { model = generateModel(raw); }
  catch (error) { collection.fail(`${id}.generate: ${error.message || error}`); }
  const entries = Object.create(null);
  let entry = { manual: true };
  const values = Object.assign({}, model.values);
  const assetPaths = Object.create(null);
  for (const [index, netlist] of model.netlists.entries()) {
    const name = netlist.id === id ? assetName : netlist.id;
    const directory = path.join(manifestRoot, netlist.id);
    const generated = {
      vars: { qdir: collection.shellQuote(directory) },
      inputs: { "netlist.v": netlist.rtl },
      steps: [`cd {qdir} && vzpac netlist netlist.v --${netlist.mode} -o assets/${name}.pdf`]
    };
    if (netlist.id === id) entry = generated;
    else entries[netlist.id] = generated;
    const filename = path.join(directory, "assets", name);
    for (const key of [`${netlist.id}Assets`, `netlist${index + 1}Assets`]) {
      if (Object.prototype.hasOwnProperty.call(values, key) ||
          (Object.prototype.hasOwnProperty.call(assetPaths, key) && assetPaths[key] !== filename)) {
        collection.fail(`${id}: generated value collision ${key}`);
      }
      assetPaths[key] = filename;
    }
  }
  return { values, entry, entries, assetPaths };
}

function generate(input, output, manifest) {
  return collection.generate(input, output, manifest, generatedEntry);
}

function register(prog) {
  prog.command("logic exercises", "Generate Boolean exercises and their native netlist asset manifest")
    .argument("<yml>", "Logic instances YAML (paths are relative to this file)")
    .option("-o, --output <markdown>", "Generated Markdown chapter", undefined, undefined, true)
    .option("--manifest <yml>", "Combined gen-assets YAML", undefined, undefined, true)
    .action((args, options) => generate(args.yml, options.output, options.manifest));
}

module.exports = { register, generate };
