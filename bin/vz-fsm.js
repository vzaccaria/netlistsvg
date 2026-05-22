#!/usr/bin/env node
"use strict";

let _ = require("lodash");
let $fs = require("mz/fs");
let $gstd = require("get-stdin");
let { elaborateFSM, dumpEx } = require("./lib/fsm");

const SUBNAME = "fsm";

let register = prog => {
  prog
    .command(SUBNAME, "Swiss Knife tool for FSM synthesis")
    .argument("[json]", "JSON file or stdin")
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
    .option("-w, --draw", "produce only latex code for drawing")
    .action((args, options) => {
      if (options.example) {
        dumpEx(options.example);
      } else {
        let datap = args.json ? $fs.readFile(args.json, "utf8") : $gstd();
        datap.then(JSON.parse).then(fsm => {
          elaborateFSM(fsm, options);
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
