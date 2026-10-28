"use strict";

const path = require("path");
const { generateSimulation } = require("./sim");
const collection = require("../exercise-collection")("mmu");
const { fail, shellQuote } = collection;

function generatedEntry(id, options, manifestRoot) {
  let simulation;
  try {
    simulation = generateSimulation(options);
  } catch (error) {
    fail(`${id}.generate: ${error.message || error}`);
  }
  const { faults } = simulation;
  const difference = faults.FIFO - faults.LRU;
  return {
    values: {
      policy: options.policy,
      policyLower: options.policy.toLowerCase(),
      faultsLRU: faults.LRU,
      faultsFIFO: faults.FIFO,
      faultRelation: difference > 0 ? "maggiore" : difference < 0 ? "minore" : "uguale",
      faultOperator: difference > 0 ? ">" : difference < 0 ? "<" : "="
    },
    entry: {
      vars: {
        prefix: shellQuote(path.join(manifestRoot, id, "assets", id)),
        alist: shellQuote(options.accesses.map(action => `${action.process}${action.npv}`).join(",")),
        processes: shellQuote(options.processes.join(",")),
        npvbits: options.npvbits,
        npfbits: options.npfbits,
        wsbits: options.wsbits,
        upto: options.upto
      },
      steps: ["vzpac mmu sim {alist} --processes={processes} --npvbits {npvbits} --npfbits {npfbits} --wsbits {wsbits} --upto={upto} -c -x {prefix}"]
    }
  };
}

function generate(input, output, manifest) {
  return collection.generate(input, output, manifest, generatedEntry);
}

function register(prog) {
  prog.command("mmu exercises", "Generate an MMU exercise chapter and asset manifest")
    .argument("<yml>", "MMU instances YAML (paths are relative to this file)")
    .option("-o, --output <markdown>", "Generated Markdown chapter", undefined, undefined, true)
    .option("--manifest <yml>", "Combined gen-assets YAML", undefined, undefined, true)
    .action((args, options) => generate(args.yml, options.output, options.manifest));
}

module.exports = { register, generate };
