#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const _ = require("lodash");

let { latexArtifact, saveArtifacts } = require("./lib/artifacts");
let { toLatexTable } = require("./lib/tex");

// let testobj = {
//   a: { d: 1, e: { f: 0, g: 1 } },
//   b: 2,
//   c: { h: 1, i: 2 }
// };

let scanl = (xs, f, ac) =>
  _.concat(ac, xs.length == 0 ? [] : scanl(_.tail(xs), f, f(ac, _.first(xs))));

// let config = {
//   system: {
//     npvbits: 2,
//     npfbits: 2,
//     wsbits: 1,
//     alinesid: 2, // not used
//     policy: "LRU"
//   },
//   processes: {
//     p: { vmap: "CCcc..DDd.0...S", asid: "00" },
//     q: { vmap: "Ccc.DDd...1.0.S", asid: "01" }
//   },
//   accesses: [
//     { process: "p", npv: "0" },
//     { process: "p", npv: "1" },
//     { process: "q", npv: "0" },
//     { process: "p", npv: "0" },
//     { process: "p", npv: "2" }
//   ]
// };

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

let preprocess = (config, j) => {
  let showPageTable = (time, p) => {
    return _.map(p, entry => {
      if (config.limit < 0 || (config.limit > 0 && time <= config.limit)) {
        if (entry.valid)
          if (config.system.policy === "LRU") {
            return `${entry.npf}{\\color{gray}/${entry.LRULastaccessed}}`;
          } else {
            if (config.system.policy === "FIFO") {
              return `${entry.npf}{\\color{gray}/${entry.FIFOloaded}}`;
            } else {
              return `ERR`;
            }
          }
        else return `-{\\color{gray}/-}`;
      } else {
        return ``;
      }
    });
  };
  let showPhysical = (time, a) => {
    if (config.limit < 0 || (config.limit > 0 && time <= config.limit)) {
      if (a.valid) {
        return `${a.process}${a.npv}`;
      } else {
        return "-";
      }
    } else return " ";
  };

  let showStats = (time, a) => {
    if (config.limit < 0 || (config.limit > 0 && time <= config.limit)) {
      return a;
    } else return " ";
  };
  return _.map(j, d => {
    let res = {
      time: d.time,
      action: d.action ? d.action : "init",
      faults: _.map(d.stats, _.curry(showStats)(d.time)),
      physical: _.map(d.physical, _.curry(showPhysical)(d.time))
    };
    res[`pageTables (npv/${config.system.policy})`] = _.mapValues(
      d.pageTables,
      _.curry(showPageTable)(d.time)
    );
    return res;
  });
};

let checkConfig = config => {
  // let npventries = Math.pow(2, config.system.npvbits);
  let npfentries = Math.pow(2, config.system.npfbits);
  let maxresident = Math.pow(2, config.system.wsbits);
  let nproc = _.size(config.processes);
  // console.log(`Phys. pages: ${npfentries}, Virt. pages: ${npventries}`);
  // console.log(`Working set: ${maxresident}, processes: ${nproc}`);
  if (maxresident * nproc > npfentries) {
    throw "Health check not passed! check working set size";
  }
};

let processSim = config => {
  let npventries = Math.pow(2, config.system.npvbits);
  let npfentries = Math.pow(2, config.system.npfbits);
  let initialState = {
    physical: _.map(_.range(0, npfentries), () => {
      return {
        valid: false
      };
    }),
    pageTables: _.mapValues(config.processes, () => {
      return _.map(_.range(0, npventries), () => {
        return { valid: false };
      });
    }),
    stats: _.mapValues(config.processes, () => {
      return 0;
    }),

    time: 0
  };
  let res = scanl(config.accesses, access(config), initialState);
  res = preprocess(config, res);
  return toLatexTable(res);
};

let access = _.curry((config, state, action) => {
  state = _.cloneDeep(state);
  let bringIn = (_process, _npv) => {
    let npf = _.findIndex(state.physical, p => !p.valid);
    if (npf === -1)
      throw "memory should at least allow all resident pages of processes";
    state.pageTables[_process][_npv] = {
      valid: true,
      npv: _npv,
      npf: npf,
      FIFOloaded: state.time,
      NFUAccesses: 1,
      LRULastaccessed: state.time
    };
    state.physical[npf] = { process: _process, valid: true, npv: _npv };
  };

  let bringOut = (_process, _npv) => {
    let npf = _.findIndex(
      state.physical,
      p => p.process === _process && p.npv === _npv
    );
    if (npf === -1) throw "inconsistency found in memory";
    state.physical[npf].valid = false;
    state.pageTables[_process][_npv] = {
      valid: false
    };
  };

  let choose = _process => {
    if (config.system.policy === "LRU") {
      // console.log(state);
      let page = _.minBy(state.pageTables[_process], "LRULastaccessed");
      return page.npv;
    } else {
      if (config.system.policy === "FIFO") {
        let page = _.maxBy(state.pageTables[_process], "FIFOloaded");
        return page.npv;
      } else throw "Method not implemented";
    }
  };

  let { process, npv } = action;
  state.time += 1;
  let resident = state.pageTables[process][npv].valid;
  if (!resident) {
    let maxresident = Math.pow(2, config.system.wsbits);
    let residentPages = _.sumBy(state.pageTables[process], g =>
      g.valid ? 1 : 0
    );
    if (residentPages == maxresident) {
      let cnpv = choose(process);
      state.stats[process] += 1;
      bringOut(process, cnpv);
      bringIn(process, npv);
    } else {
      state.stats[process] += 1;
      bringIn(process, npv);
    }
  } else {
    state.pageTables[process][npv].NFUAccesses += 1;
    state.pageTables[process][npv].LRULastaccessed = state.time;
  }
  state.action = `${process}$\\rightarrow$npv(${npv})`;
  return state;
});

let produceAndSaveArtifacts = async (args, options) => {
  let result = {
    latex: [
      latexArtifact(
        processSim(produceConfig(args, options, "LRU", -1)),
        "lru",
        "standalone",
        "pdflatex",
        ""
      ),
      latexArtifact(
        processSim(produceConfig(args, options, "FIFO", -1)),
        "fifo",
        "standalone",
        "pdflatex",
        ""
      ),
      latexArtifact(
        processSim(produceConfig(args, options, "LRU", options.upto)),
        "lru blank",
        "standalone",
        "pdflatex",
        ""
      ),
      latexArtifact(
        processSim(produceConfig(args, options, "FIFO", options.upto)),
        "fifo blank",
        "standalone",
        "pdflatex",
        ""
      )
    ]
  };
  if (options.save) {
    return saveArtifacts(result.latex, options.save);
  } else {
    console.log(JSON.stringify(result));
  }
};

let main = () => {
  prog
    .description("Cache utils")
    .command("sim")
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
    )
    .action(async (args, options) => {
      produceAndSaveArtifacts(args, options);
      // checkConfig(config);
      // console.log(processSim(config));
    });
  prog.parse(process.argv);
};

main();
