#!/usr/bin/env node
"use strict";

let _ = require("lodash");
let $fs = require("mz/fs");
let $gstd = require("get-stdin");
let { synthesize } = require("./lib/quine");
let { saveArtifacts } = require("./lib/artifacts.js");

const prog = require("caporal");

let main = () => {
  prog
    .description("Swiss Knife tool for boolean function minimization")
    .argument("<table>", "table")
    .option(
      "-s, --save <prefix>",
      "Save data into specified prefix files (otw dump json)"
    )
    .option("-x, --var <prefix>", "Prefix of variables", prog.STRING, "x")
    .option("-r, --vars <string>", "List of variables (Alternative to -x)")
    .action((args, options) => {
      let nvars = Math.ceil(Math.log2(args.table.length));
      let vars = _.map(_.range(0, nvars), v => `${options.var}_${v}`);
      if (options.vars) vars = _.concat(options.vars.split(","), vars);
      let s = synthesize(args.table, vars);
      if (!options.save) {
        console.log(JSON.stringify(s, 0, 4));
      } else {
        return saveArtifacts(s.latex, options.save);
      }
    });
  prog.parse(process.argv);
};

main();
