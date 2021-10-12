#!/usr/bin/env node
"use strict";

const name = "vz-sched";
const prog = require("caporal");
const { runAndSave } = require("./lib/" + name + "/lib");
// const { schedule } = require("./lib/" + name + "/fixtures");
let $fs = require("mz/fs");
let $gstd = require("get-stdin");

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
      let datap = args.json ? $fs.readFile(args.json, "utf8") : $gstd();
      datap.then(JSON.parse).then(sched => {
        runAndSave(options, sched);
      });
    });
  prog.parse(process.argv);
};

main();
