#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const _ = require("lodash");

// let { latexArtifact, saveArtifacts } = require("./lib/artifacts");
let { toLatexTable } = require("./lib/tex");

// let testobj = {
//   a: { d: 1, e: { f: 0, g: 1 } },
//   b: 2,
//   c: { h: 1, i: 2 }
// };

let scanl = (xs, f, ac) =>
  _.concat(ac, xs.length == 0 ? [] : scanl(_.tail(xs), f, f(ac, _.first(xs))));

let config = {
  system: {
    npvbits: 2,
    npfbits: 2,
    wsbits: 1,
    asid: 2,
    policy: "LRU"
  },
  processes: {
    p: { vmap: "CCcc..DDd.0...S", asid: "00" },
    q: { vmap: "Ccc.DDd...1.0.S", asid: "01" }
  },
  accesses: [
    { process: "p", npv: "0" },
    { process: "p", npv: "1" },
    { process: "q", npv: "0" },
    { process: "p", npv: "0" },
    { process: "p", npv: "2" }
  ]
};

let preprocess = (config, j) => {
  let showPageTable = p => {
    return _.map(p, entry => {
      if (entry.valid)
        return `${entry.npf}{\\color{gray}/${entry.LRULastaccessed}}`;
      else return "-";
    });
  };
  let showPhysical = a => {
    if (a.valid) {
      return `${a.process}${a.npv}`;
    } else {
      return "-";
    }
  };
  return _.map(j, d => {
    return {
      time: d.time,
      action: d.action ? d.action : "init",
      faults: d.stats,
      physical: _.map(d.physical, showPhysical),
      pageTables: _.mapValues(d.pageTables, showPageTable)
    };
  });
};

let checkConfig = config => {
  let npventries = Math.pow(2, config.system.npvbits);
  let npfentries = Math.pow(2, config.system.npfbits);
  let maxresident = Math.pow(2, config.system.wsbits);
  let nproc = _.size(config.processes);
  console.log(`Phys. pages: ${npfentries}, Virt. pages: ${npventries}`);
  console.log(`Working set: ${maxresident}, processes: ${nproc}`);
  if (maxresident * nproc > npfentries) {
    console.log("Health check not passed! check working set size");
  } else {
    console.log("Ok, health check passed");
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
    } else throw "Method not implemented";
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
  state.action = `${process}->npv(${npv})`;
  return state;
});

let main = () => {
  prog
    .description("Cache utils")
    .command("sim")
    .action(async args => {
      // checkConfig(config);
      console.log(processSim(config));
    });
  prog.parse(process.argv);
};

main();
