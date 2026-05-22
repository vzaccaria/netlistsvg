#!/usr/bin/env node
"use strict";

let $fs = require("mz/fs");
let $gstd = require("get-stdin");
let { execWithString } = require("./lib/common");
let { exec } = require("mz/child_process");
let { latexArtifact } = require("./lib/artifacts");

const SUBNAME = "memmap";

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

let register = prog => {
  prog
    .command(`${SUBNAME} generate`, "Memory map generator")
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
    });

  prog
    .command(`${SUBNAME} preamble`, "Print latex preamble")
    .action(() => {
      exec(`cat ${__dirname}/preambles/memmap.tex`).then(output => {
        console.log(output[0]);
      });
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
