#!/usr/bin/env node
"use strict";

const name = "vz-sched";
const { runAndSave } = require("./lib/" + name + "/lib");
const { generate: generateExercises } = require("./lib/" + name + "/exercises");
const { addCompileOptions } = require("./lib/artifacts");
let $fs = require("mz/fs");
let $gstd = require("get-stdin");

const SUBNAME = "sched";

let register = prog => {
  let cmd = prog
    .command(SUBNAME, "CFS diagrams, or sched exercises <yaml> -o <markdown> --manifest <yaml>")
    .argument("[json]", "JSON file, stdin if omitted, or 'exercises' for a YAML collection")
    .argument("[yaml]", "Collection YAML after 'exercises'")
    .option("-o, --output <markdown>", "Generated collection chapter")
    .option("--manifest <yaml>", "Generated collection asset manifest")
    .option(
      "-s, --save <string>",
      "save data with in files with prefix <string>"
    )
    .option("-w, --draw", "produce only latex code for drawing")
    .option("-n, --num <int>", "which test schedule", prog.INT, 9);
  addCompileOptions(cmd).action(async (args, options) => {
    // Caporal 1 selects a parent before nested command names.
    if (args.json === "exercises") {
      if (!args.yaml) throw new Error("sched exercises requires a YAML file");
      return generateExercises(args.yaml, options.output, options.manifest);
    }
    if (args.yaml || options.output || options.manifest) throw new Error("Use sched exercises <yaml> -o <markdown> --manifest <yaml> for collections");
    const data = await (args.json ? $fs.readFile(args.json, "utf8") : $gstd());
    await runAndSave(options, JSON.parse(data));
  });
};

module.exports = { register };

if (require.main === module) {
  const prog = require("caporal");
  register(prog);
  prog.parse([
    process.argv[0],
    process.argv[1],
    SUBNAME,
    ...process.argv.slice(2)
  ]);
}
