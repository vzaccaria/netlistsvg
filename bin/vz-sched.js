#!/usr/bin/env node
"use strict";

const name = "vz-sched";
const prog = require("caporal");
const { eventLoop, saveIt } = require("./lib/" + name + "/lib");
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
    .option("-w, --draw", "produce only latex code for drawing")
    .action((args, options) => {
      // let result = run(options, schedule);
      let history = eventLoop(options, schedule2);
      saveIt(options, history, schedule2);
      console.log("done");
    });
  prog.parse(process.argv);
};

main();
