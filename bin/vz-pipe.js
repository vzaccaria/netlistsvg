#!/usr/bin/env node
"use strict";

let $fs = require("mz/fs");
let { runAndSave } = require("./lib/vz-pipe/lib");
let { addCompileOptions } = require("./lib/artifacts");

const SUBNAME = "pipe";

let register = prog => {
  let cmd = prog
    .command(`${SUBNAME} pipesim`, "Pipeline visualization generator")
    .argument(
      "<program>",
      `The instructions separated by commas e.g.: 'lw(2, 1),add(4, 2, 5)'`
    )
    .option("-s, --save <prefix>", "save with prefix or dump json")
    .option("-f, --fw", "Use forwarding")
    .option("--branchpred", "Use branch prediction")
    .option("--branchopt", "Compute the branch sooner")
    .option("-b, --blank", "To fill up")
    .option("-o, --no-instructions", "Don't show instructions")
    .option("-n, --max-cycles <integer>", "Grid size")
    .option("--is-loop", "Use a 'loop' label for both code start and branch")
    .option(
      "--asm-ins <integer>",
      "How many asm instructions to print (useful for initial parts of loops)",
      prog.INT
    )
    .option("--conflicts <string>", "Conflicts strings (comma separated)")
    .option("-d, --debug", "Debug print")
    .option(
      "--hrowsep <double>",
      "Hazard tikz row separation",
      prog.DOUBLE,
      1.3
    );
  addCompileOptions(cmd).action((args, options) => {
    runAndSave(options, args.program);
  });

  prog
    .command(`${SUBNAME} preamble`, "Print latex preamble")
    .action(() => {
      $fs.readFile(`${__dirname}/preambles/pipe.tex`, "utf8").then(console.log);
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
