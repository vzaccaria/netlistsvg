#!/usr/bin/env node
"use strict";

let $fs = require("mz/fs");
let $gstd = require("get-stdin");
let { execWithString } = require("./lib/common");
let { exec } = require("mz/child_process");
let { latexArtifact } = require("./lib/artifacts");

const prog = require("caporal");

let printResult = latex => {
  return {
    latex: [
      latexArtifact(
        latex,
        "memory diagram",
        "article",
        "pdflatex",
        `-i ${__dirname}/preambles/memmap.tex`
      )
    ]
  };
};

let main = () => {
  prog
    .description("Memory map generator")
    .command("generate")
    .argument("[csvfile]")
    .option("-t, --latex")
    .action((args, options, logger) => {
      (args.csvfile ? $fs.readFile(args.csvfile, "utf8") : $gstd()).then(data =>
        execWithString(
          path => `${__dirname}/lib/generate_mem_diagram.py -i ${path}`,
          data,
          { logger }
        ).then(output => {
          if (options.latex) {
            console.log(output);
          } else {
            console.log(JSON.stringify(printResult(output)));
          }
        })
      );
    })
    .command("preamble")
    .action(() => {
      exec(`cat ${__dirname}/preambles/memmap.tex`).then(output => {
        console.log(output[0]);
      });
    });
  prog.parse(process.argv);
};

main();
