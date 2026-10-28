"use strict";

const path = require("path");
const { generateModel } = require("./model");
const collection = require("../exercise-collection")("pipe");
const { fail, shellQuote } = collection;

function generatedEntry(id, raw, manifestRoot) {
  let model;
  try { model = generateModel(raw); }
  catch (error) { fail(`${id}.generate: ${error.message || error}`); }
  const { options } = model;
  const vars = {
    prefix: shellQuote(path.join(manifestRoot, id, "assets", id)),
    program: shellQuote(model.program)
  };
  const flags = [];
  for (const [field, flag] of Object.entries({ fw: "--fw", branchopt: "--branchopt", branchpred: "--branchpred", isLoop: "--is-loop", noInstructions: "--no-instructions" })) {
    if (options[field]) flags.push(flag);
  }
  for (const [field, flag] of Object.entries({ maxCycles: "--max-cycles", asmIns: "--asm-ins", hrowsep: "--hrowsep", conflicts: "--conflicts" })) {
    if (options[field] !== undefined && options[field] !== "") {
      vars[field] = field === "conflicts" ? shellQuote(options[field]) : options[field];
      flags.push(`${flag} {${field}}`);
    }
  }
  return { values: model.values, entry: { vars, steps: [`vzpac pipe pipesim {program} ${flags.join(" ")} -c -s {prefix}`] } };
}

function generate(input, output, manifest) {
  return collection.generate(input, output, manifest, generatedEntry);
}

function register(prog) {
  prog.command("pipe exercises", "Generate a pipeline chapter and asset manifest")
    .argument("<yml>", "Pipeline instances YAML (paths are relative to this file)")
    .option("-o, --output <markdown>", "Generated Markdown chapter", undefined, undefined, true)
    .option("--manifest <yml>", "Generated gen-assets YAML", undefined, undefined, true)
    .action((args, options) => generate(args.yml, options.output, options.manifest));
}

module.exports = { register, generate };
