#!/usr/bin/env node
"use strict";

const _ = require("lodash");

const SUBNAME = "mmu";

let {
  writeArtifacts,
  addCompileOptions
} = require("./lib/artifacts");
const { generateArtifacts } = require("./lib/vz-mmu/sim");
const exercises = require("./lib/vz-mmu/exercises");

let produceConfig = (args, options, algo, limit) => {
  let config = {
    system: {
      npvbits: options.npvbits,
      npfbits: options.npfbits,
      wsbits: options.wsbits,
      policy: algo
    },

    processes: _.fromPairs(
      _.map(options.processes, p => {
        return [p, { valid: true }];
      })
    ),
    accesses: _.map(args.alist.split(","), p => {
      let regexp = /(?<process>[a-z]+)(?<npv>\d+)/;
      let x = p.match(regexp);
      if (!_.isNull(x)) {
        return x.groups;
      } else {
        throw "error parsing acceses";
      }
    }),
    limit: limit
  };
  return config;
};

let produceAndSaveArtifacts = async (args, options) => {
  const result = generateArtifacts(produceConfig(args, options, "FIFO", options.upto));
  if (options.save) {
    return writeArtifacts(result.latex, options);
  } else {
    console.log(JSON.stringify({ latex: result.latex }));
  }
};

let register = prog => {
  exercises.register(prog);
  let cmd = prog
    .command(`${SUBNAME} sim`, "MMU paging simulator")
    .argument(
      "<alist>",
      "comma separated list of virtual page accesses (e.g. 'p0,q1...')"
    )
    .option(
      "--npvbits <num>",
      "virtual page number size (log2)",
      prog.INTEGER,
      2
    )
    .option(
      "--npfbits <num>",
      "physical page number size (log2)",
      prog.INTEGER,
      2
    )
    .option("-x, --save <prefix>", "save with prefix or dump json")
    .option("--wsbits <num>", "working set size (log2)", prog.INTEGER, 1)
    .option(
      "--processes <list>",
      "comma separated list of processes",
      prog.LIST
    )
    .option(
      "--upto <num>",
      "starting from <num> dont print anything in blank",
      prog.INTEGER,
      -1
    );
  addCompileOptions(cmd).action(async (args, options) => {
    return produceAndSaveArtifacts(args, options);
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
