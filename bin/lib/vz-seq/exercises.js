"use strict";

const path = require("path");
const { generateModel } = require("./model");
const collection = require("../exercise-collection")("seq");
const { shellQuote } = collection;

function generatedEntry(id, raw, manifestRoot, assetName, inputRoot) {
  let model;
  try { model = generateModel(raw); }
  catch (error) { collection.fail(`${id}.generate: ${error.message || error}`); }
  if (model.prose) return {
    values: model.values,
    entry: { manual: true },
    assetPaths: raw.circuitFigure === undefined ? {} :
      { circuitFigure: collection.relativeInput(inputRoot, raw.circuitFigure, `${id}.circuitFigure`) }
  };
  const { wave, netlist } = model;
  const steps = ["cd {qdir} && iverilog -o exe test_cb.v", "cd {qdir} && vvp exe"];
  if (wave.renderer === "wave") {
    const signals = wave.signals ? ` -s ${shellQuote(wave.signals.join(","))}` : "";
    steps.push(`vzpac wave {qdir}/test.vcd -n --is-vcd${signals} --end ${wave.end} -w ${shellQuote(wave.whitelist.join(","))} -c -a {qdir}/assets/test`);
  } else {
    const hidden = wave.signals.filter(signal => !wave.whitelist.includes(signal));
    const radix = wave.radix === undefined ? "" : ` -r ${wave.radix}`;
    steps.push(`sootty {qdir}/test.vcd -w ${shellQuote(wave.signals.join(","))} -e ${shellQuote(`time ${wave.end}`)}${radix} -o > {qdir}/assets/test-wave.svg`);
    steps.push(hidden.length ?
      `vzpac sootty mask {qdir}/assets/test-wave.svg {qdir}/assets/test-wave-whitelisted.svg ${shellQuote(hidden.join(","))}` :
      "cp {qdir}/assets/test-wave.svg {qdir}/assets/test-wave-whitelisted.svg");
    for (const basename of ["test-wave", "test-wave-whitelisted"]) steps.push(`cairosvg {qdir}/assets/${basename}.svg -f pdf -o {qdir}/assets/${basename}.pdf`);
  }
  let netlistOptions = netlist.mode === undefined ? "" : netlist.mode === "techmap" ?
    ` -v -k --script ${shellQuote("prep -auto-top; techmap; opt;")}` : ` --${netlist.mode}`;
  if (netlist.ffIndices !== undefined) netlistOptions += ` --ff-indices ${shellQuote(netlist.ffIndices.join(","))}`;
  if (netlist.skin !== undefined) netlistOptions += ` --skin ${shellQuote(collection.relativeInput(inputRoot, netlist.skin, `${id}.netlist.skin`))}`;
  steps.push(`vzpac netlist {qdir}/test.v${netlistOptions} -o {qdir}/assets/test-diag.pdf`);
  const directory = path.join(manifestRoot, id);
  return {
    values: model.values,
    entry: {
      vars: { qdir: shellQuote(directory) },
      inputs: { "test.v": model.rtl, "test_cb.v": model.testbench },
      steps,
      cleanup: ["exe", "test.vcd"]
    },
    assetPaths: Object.fromEntries([["diagramAssets", "test-diag"], ["waveAssets", "test-wave"], ["maskedWaveAssets", "test-wave-whitelisted"]]
      .map(([name, basename]) => [name, path.join(directory, "assets", basename)]))
  };
}

function generate(input, output, manifest) {
  return collection.generate(input, output, manifest, generatedEntry);
}

function register(prog) {
  prog.command("seq exercises", "Generate native sequential circuits, testbenches and waveform exercise manifests")
    .argument("<yml>", "Sequential instances YAML (paths are relative to this file)")
    .option("-o, --output <markdown>", "Generated Markdown chapter", undefined, undefined, true)
    .option("--manifest <yml>", "Combined gen-assets YAML", undefined, undefined, true)
    .action((args, options) => generate(args.yml, options.output, options.manifest));
}

module.exports = { register, generate };
