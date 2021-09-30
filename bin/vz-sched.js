#!/usr/bin/env node
"use strict";

const name = "vz-sched";
const prog = require("caporal");
const { eventLoop, schedule0, schedule1 } = require("./lib/" + name + "/lib");

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
      eventLoop(options, schedule0);
      //saveIt(options, result);
    });
  prog.parse(process.argv);
};

main();
