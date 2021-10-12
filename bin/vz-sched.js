#!/usr/bin/env node
"use strict";

const name = "vz-sched";
const prog = require("caporal");
const { eventLoop, saveIt, runAndSave } = require("./lib/" + name + "/lib");
const { schedule } = require("./lib/" + name + "/fixtures");

let main = () => {
  prog
    .description("Swiss Knife tool schedule diagrams")
    .argument("[json]", "JSON file or stdin")
    .option(
      "-s, --save <string>",
      "save data with in files with prefix <string>"
    )
    .option("-w, --draw", "produce only latex code for drawing")
    .option("-n, --num <int>", "which test schedule", prog.INT, 9)
    .action((args, options) => {
      // let result = run(options, schedule);
      runAndSave(options, schedule[options.num]);
    });
  prog.parse(process.argv);
};

main();
