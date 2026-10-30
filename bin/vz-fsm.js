#!/usr/bin/env node
"use strict";

let $fs = require("mz/fs");
let $gstd = require("get-stdin");
let { elaborateFSM, dumpEx } = require("./lib/fsm");
let { addCompileOptions } = require("./lib/artifacts");
const { generate: generateExercises } = require("./lib/vz-fsm/exercises");

const SUBNAME = "fsm";

let register = prog => {
  let cmd = prog
    .command(SUBNAME, "FSM synthesis, or fsm exercises <yaml> -o <markdown> --manifest <yaml>")
    .argument("[json]", "JSON file, stdin if omitted, or 'exercises' for a YAML collection")
    .argument("[yaml]", "Collection YAML after 'exercises'")
    .option("-o, --output <markdown>", "Generated collection chapter")
    .option("--manifest <yaml>", "Generated collection asset manifest")
    .option(
      "-s, --save <string>",
      "save data with in files with prefix <string>"
    )
    .option(
      "-r, --random-seed <value>",
      "random seed to use for force directed layout",
      prog.INTEGER,
      1
    )
    .option(
      "-e, --example <string>",
      "dump example for <string> = (moore|mealy)"
    )
    .option("-w, --draw", "produce only latex code for drawing");
  addCompileOptions(cmd).action((args, options) => {
      // Caporal 1 selects a parent before nested command names.
      if (args.json === "exercises") {
        if (!args.yaml) throw new Error("fsm exercises requires a YAML file");
        return generateExercises(args.yaml, options.output, options.manifest);
      }
      if (args.yaml || options.output || options.manifest) throw new Error("Use fsm exercises <yaml> -o <markdown> --manifest <yaml> for collections");
      if (options.example) {
        dumpEx(options.example);
      } else {
        let datap = args.json ? $fs.readFile(args.json, "utf8") : $gstd();
        return datap.then(JSON.parse).then(fsm => {
          return elaborateFSM(fsm, options);
        });
      }
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
