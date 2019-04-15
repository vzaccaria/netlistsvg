#!/usr/bin/env node
"use strict";

let _ = require("lodash");
let $fs = require("mz/fs");
let $gstd = require("get-stdin");
let { drawFSM, dumpEx } = require("./fsm");
let { synthesize } = require("./quine");

const prog = require("caporal");

let saveSynthesisResults = (prefix, data) => {
  Promise.all(
    _.concat(
      [
        $fs.writeFile(
          `${prefix}-tables-complete.tex`,
          data.latex.implicantsTables,
          "utf8"
        ),
        $fs.writeFile(`${prefix}-sop.tex`, data.latex.sopForm, "utf8"),
        $fs.writeFile(`${prefix}-soluzione.tex`, data.latex.soluzione, "utf8"),
        $fs.writeFile(`${prefix}-solution.tex`, data.latex.solution, "utf8"),
        $fs.writeFile(`${prefix}-karnaugh.tex`, data.latex.karnaugh, "utf8"),
        $fs.writeFile(
          `${prefix}-chart-all.tex`,
          data.latex.implicantsChartsAll,
          "utf8"
        )
      ],
      _.map(data.latex.implicantsCharts, (v, i) => {
        return $fs.writeFile(`${prefix}-chart-${i}.tex`, v, "utf8");
      })
    )
  );
};

let main = () => {
  prog
    .description("Swiss Knife tool for boolean function minimization")
    .command("quinett", "produce a quine minimization sheet")
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
        return saveSynthesisResults(options.save, s);
      }
    })
    .command("fsm", "produce data for state machine")
    .argument("[json]", "JSON file or stdin")
    .option(
      "-r, --random-seed <value>",
      "random seed to use for force directed layout",
      prog.INTEGER,
      1
    )
    .option(
      "-d, --node-distance <value>",
      "random seed to use for force directed layout",
      prog.STRING,
      "2cm"
    )
    .option(
      "-e, --example <string>",
      "dump example for <string> = (moore|mealy)"
    )
    .option("-w, --draw", "produce only latex code for drawing")
    .action((args, options) => {
      if (options.template) {
        dumpEx(options.template);
      } else {
        let datap = args.json ? $fs.readFile(args.json, "utf8") : $gstd();
        datap.then(JSON.parse).then(fsm => {
          if (options.draw) {
            console.log(drawFSM(fsm, options));
          } else {
          }
        });
      }
    });
  prog.parse(process.argv);
};

main();
