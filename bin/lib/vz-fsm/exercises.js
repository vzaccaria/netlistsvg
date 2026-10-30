"use strict";

const path = require("path");
const { generateModel } = require("./model");
const collection = require("../exercise-collection")("fsm");

function generatedEntry(id, raw, manifestRoot, assetName) {
  let model;
  try { model = generateModel(raw); }
  catch (error) { collection.fail(`${id}.generate: ${error.message || error}`); }
  if (model.prose) return { values: model.values, entry: { manual: true } };
  const directory = path.join(manifestRoot, id);
  const prefix = path.join(directory, "assets", assetName);
  const draw = model.options.draw ? " -w" : "";
  const seed = model.options.randomSeed === 1 ? "" : ` -r ${model.options.randomSeed}`;
  const markdown = {};
  if (raw.flipFlop !== undefined) {
    const pins = { D: ["d"], SR: ["s", "r"], T: ["t"], JK: ["j", "k"] }[raw.flipFlop];
    const bits = Array.from({ length: model.fsm.encodingSize }, (_, bit) => bit);
    const outputs = raw.flipFlop === "SR" ?
      pins.flatMap(pin => bits.map(bit => ({ pin, bit }))) :
      bits.flatMap(bit => pins.map(pin => ({ pin, bit })));
    markdown.excitationExpressionsMarkdown = outputs.map(({ pin, bit }) =>
      `![](\${${pin}${bit}ExpressionAssets}.svg){#fig-${id}-${pin}-${bit}-expression}\n%% [edit](\${source}) %%`).join("\n\n");
  }
  return {
    values: model.values,
    markdown,
    entry: {
      vars: { qdir: collection.shellQuote(directory) },
      inputs: { "fsm.json": JSON.stringify(model.fsm, null, 2) + "\n" },
      steps: [`vzpac fsm {qdir}/fsm.json${draw}${seed} -c -s {qdir}/assets/${assetName}`]
    },
    assetPaths: Object.fromEntries(Object.entries(model.suffixes).map(([name, suffix]) => [name, `${prefix}-${suffix}`]))
  };
}

function generate(input, output, manifest) {
  return collection.generate(input, output, manifest, generatedEntry);
}


module.exports = { generate };
