#!/usr/bin/env node
"use strict";

let _ = require("lodash");
let $fs = require("mz/fs");
let $gstd = require("get-stdin");
let { compileArtifacts } = require("./lib/artifacts");

const prog = require("caporal");

let main = () => {
  prog
    .description("Produce pdf artifacts")
    .argument("[json]", "JSON file or stdin")
    .option(
      "-p, --prefix <string>",
      "save data with in files with prefix <string>",
            prog.STRING,
            "tmp"
    )
    .action((args, options) => {
      let datap = args.json ? $fs.readFile(args.json, "utf8") : $gstd();
      datap.then(JSON.parse).then(data => {
        compileArtifacts(data.latex, options.prefix);
      });
    });
  prog.parse(process.argv);
};

main();
