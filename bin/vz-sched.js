#!/usr/bin/env node
"use strict";

const name = "vz-sched";
const prog = require("caporal");
const { eventLoop } = require("./lib/" + name + "/lib");
const { schedule0, schedule1, schedule2 } = require("./lib/" +
  name +
  "/fixtures");

let main = () => {
  prog
    .description("Swiss Knife tool schedule diagrams")
    .argument("[json]", "JSON file or stdin")
    .option(
      "-s, --save <string>",
      "save data with in files with prefix <string>"
    )
    .option(
      "-e, --example <string>",
      "dump example for <string> = (moore|mealy)"
    )
    .option("-w, --draw", "produce only latex code for drawing")
    .action((args, options) => {
      // let result = run(options, schedule);
      eventLoop(options, schedule2);
      //saveIt(options, result);
    });
  prog.parse(process.argv);
};

main();
