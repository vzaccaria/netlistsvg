#!/usr/bin/env node
"use strict";

const name = "vz-sched";
const { runAndSave } = require("./lib/" + name + "/lib");
const { addCompileOptions } = require("./lib/artifacts");
let $fs = require("mz/fs");
let $gstd = require("get-stdin");

const SUBNAME = "sched";

let register = prog => {
  let cmd = prog
    .command(SUBNAME, "Swiss Knife tool schedule diagrams")
    .argument("[json]", "JSON file or stdin")
    .option(
      "-s, --save <string>",
      "save data with in files with prefix <string>"
    )
    .option("-w, --draw", "produce only latex code for drawing")
    .option("-n, --num <int>", "which test schedule", prog.INT, 9);
  addCompileOptions(cmd).action((args, options) => {
    let datap = args.json ? $fs.readFile(args.json, "utf8") : $gstd();
    datap.then(JSON.parse).then(sched => {
      runAndSave(options, sched);
    });
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
