#!/usr/bin/env node
"use strict";

let _ = require("lodash");
let $fs = require("mz/fs");
let $gstd = require("get-stdin");
let { synthesize } = require("./lib/quine");
let { writeArtifacts, addCompileOptions } = require("./lib/artifacts.js");

const SUBNAME = "quine";

let register = prog => {
  let cmd = prog
    .command(SUBNAME, "Swiss Knife tool for boolean function minimization")
    .argument("<table>", "table")
    .option(
      "-s, --save <prefix>",
      "Save data into specified prefix files (otw dump json)"
    )
    .option("-x, --var <prefix>", "Prefix of variables", prog.STRING, "x")
    .option("-r, --vars <string>", "List of variables (Alternative to -x)");
  addCompileOptions(cmd).action((args, options) => {
    let nvars = Math.ceil(Math.log2(args.table.length));
    let vars = _.map(_.range(0, nvars), v => `${options.var}_${v}`);
    if (options.vars) vars = options.vars.split(",");
    let s = synthesize(args.table, vars);
    if (!options.save) {
      console.log(JSON.stringify(s, 0, 4));
    } else {
      return writeArtifacts(s.latex, options);
    }
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
