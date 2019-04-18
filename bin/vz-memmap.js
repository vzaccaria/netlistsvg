#!/usr/bin/env node
"use strict";

let _ = require("lodash");
let $fs = require("mz/fs");
let $gstd = require("get-stdin");
let { execWithString } = require("./lib/common");
let { exec } = require("mz/child_process");

const prog = require("caporal");

let main = () => {
  prog
    .description("Memory map generator")
    .command("generate")
    .argument("[csvfile]>")
    .action((args, options, logger) => {
      (args.csvfile ? $fs.readFile(args.csvfile, "utf8") : $gstd()).then(data =>
        execWithString(
          path => `${__dirname}/lib/generate_mem_diagram.py -i ${path}`,
          data,
          { logger }
        ).then(output => {
          console.log(output);
        })
      );
    })
    .command("preamble")
    .action(() => {
      exec(`${__dirname}/lib/generate_mem_diagram.py -r`).then(output => {
        console.log(output[0]);
      });
    });
  prog.parse(process.argv);
};

main();
