#!/usr/bin/env node
"use strict";

const prog = require("caporal");

var lib = require("../lib");
var $fs = require("mz/fs");
var $gstd = require("get-stdin");

let main = () => {
  prog
    .description("Produce a pdf file from a yosys json netlist")
    .argument("[file]", "optional JSON file, otherwise read from stdin")
    .option(
      "--skin <filename>",
      "Use skin <filename>",
      prog.STRING,
      `${__dirname}/../lib/default.svg`
    )
    .action((args, options) => {
      let skin_data = $fs.readFile(options.skin, "utf-8");
      let netlist_data = args.file ? $fs.readFile(args.file, "utf-8") : $gstd();
      Promise.all([skin_data, netlist_data])
        .then(([sd, nd]) => {
          nd = JSON.parse(nd);
          return lib.render(sd, nd);
        })
        .then(svg => {
          console.log(svg);
        });
    });
  prog.parse(process.argv);
};

main();
