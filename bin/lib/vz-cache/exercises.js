"use strict";

const path = require("path");
const { generateSimulation } = require("./sim");

const collection = require("../exercise-collection")("cache");
const { fail, mapping, shellQuote } = collection;
const GENERATE_FLAGS = {
  seed: "--seed",
  blocks: "--blocks",
  accesses: "--accesses",
  hits: "--hits",
  minHits: "--min-hits",
  maxHits: "--max-hits",
  conflicts: "--conflicts",
  initial: "--initial",
  membits: "--membits",
  blockbits: "--blockbits",
  ways: "--ways"
};



function generatedEntry(id, raw, manifestRoot, assetName) {
  const label = `${id}.generate`;
  const options = Object.assign(Object.create(null), { seed: id }, mapping(raw, label));
  for (const [name, value] of Object.entries(options)) {
    if (!Object.prototype.hasOwnProperty.call(GENERATE_FLAGS, name)) {
      fail(`${label}: unknown option ${name}`);
    }
    if (name === "seed") {
      if (!(typeof value === "string" && value.trim()) && !Number.isSafeInteger(value)) {
        fail(`${label}.seed must be a non-empty string or a safe integer`);
      }
    } else if ((name === "accesses" || name === "initial") && Array.isArray(value)) {
      continue;
    } else if (!Number.isSafeInteger(value)) {
      fail(`${label}.${name} must be an integer`);
    }
  }
  // Validate with the real generator before replacing either output. The asset
  // command receives the same seed, so configuration and trace stay identical.
  let simulation;
  try {
    simulation = generateSimulation(options);
  } catch (error) {
    fail(`${label}: ${error.message || error}`);
  }
  const vars = { prefix: shellQuote(path.join(manifestRoot, id, "assets", assetName)) };
  const flags = [];
  for (const [name, flag] of Object.entries(GENERATE_FLAGS)) {
    if (options[name] === undefined) continue;
    const structured = name === "initial" || (name === "accesses" && Array.isArray(options[name]));
    const flagName = name === "accesses" && structured ? "--trace" : flag;
    vars[name] = structured ? shellQuote(JSON.stringify(options[name]))
      : name === "seed" ? shellQuote(String(options[name])) : options[name];
    flags.push(structured || name === "seed" ? `${flagName}={${name}}` : `${flagName} {${name}}`);
  }
  return {
    values: {
      blocks: simulation.config.numberOfBlocks,
      ways: simulation.config.associativity,
      initialValid: simulation.initial.filter(line => line.valid).length,
      hits: simulation.hitCount
    },
    entry: {
      vars,
      steps: [`vzpac cache-new sim ${flags.join(" ")} -c -x {prefix}`]
    }
  };
}

function generate(input, output, manifest) {
  return collection.generate(input, output, manifest, generatedEntry);
}

function register(prog) {
  prog.command("cache exercises", "Generate a cache exercise chapter and combined asset manifest")
    .argument("<yml>", "Cache instances YAML (paths are relative to this file)")
    .option("-o, --output <markdown>", "Generated Markdown chapter", undefined, undefined, true)
    .option("--manifest <yml>", "Combined gen-assets YAML", undefined, undefined, true)
    .action((args, options) => generate(args.yml, options.output, options.manifest));
}

module.exports = { register, generate, generatedEntry };
