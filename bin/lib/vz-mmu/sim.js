"use strict";

const _ = require("lodash");
const { latexArtifact } = require("../artifacts");
const { toLatexTable } = require("../tex");

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
      tempo: d.time,
      azione: d.action ? d.action : "init",
      fault: _.mapValues(d.stats, _.curry(showStats)(d.time)),
      physical: _.map(d.physical, _.curry(showPhysical)(d.time))
    };
    res[`pageTables (npv/${config.system.policy})`] = _.mapValues(
      d.pageTables,
      _.curry(showPageTable)(d.time)
    );
    return res;
  });
};

let printConfig = config => {
  let p = {
    sistema: {
      processi: _.join(_.map(config.processes, (v, k) => k), ", "),
      "n. pagine fisiche": Math.pow(2, config.system.npfbits),
      "n. pagine virtuali per processo": Math.pow(2, config.system.npvbits),
      "dimensione working set": Math.pow(2, config.system.wsbits)
    }
  };
  return toLatexTable([p]);
};

const simulate = config => {
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
  const states = [initialState];
  for (const action of config.accesses) states.push(access(config, states[states.length - 1], action));
  return states;
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
      let page = _.minBy(state.pageTables[_process], "LRULastaccessed");
      return page.npv;
    } else {
      if (config.system.policy === "FIFO") {
        let page = _.minBy(state.pageTables[_process], "FIFOloaded");
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

function generateArtifacts(config) {
  const policies = {};
  const faults = {};
  for (const policy of ["LRU", "FIFO"]) {
    const current = Object.assign({}, config, {
      system: Object.assign({}, config.system, { policy })
    });
    const states = simulate(current);
    policies[policy] = {
      complete: toLatexTable(preprocess(Object.assign({}, current, { limit: -1 }), states)),
      blank: toLatexTable(preprocess(current, states))
    };
    faults[policy] = _.sum(Object.values(states[states.length - 1].stats));
  }
  const artifact = (code, name) => latexArtifact(code, name, "standalone", "pdflatex", "");
  return {
    latex: [
      artifact(policies.LRU.complete, "lru"),
      artifact(policies.FIFO.complete, "fifo"),
      artifact(policies.LRU.blank, "lru blank"),
      artifact(policies.FIFO.blank, "fifo blank"),
      artifact(printConfig(config), "configurazione")
    ],
    faults
  };
}

function validateOptions(options) {
  const fail = message => { throw new Error(message); };
  if (!options || typeof options !== "object" || Array.isArray(options)) fail("generate must be a mapping");
  const fields = ["processes", "accesses", "npvbits", "npfbits", "wsbits", "upto", "policy"];
  for (const name of Object.keys(options)) {
    if (!fields.includes(name)) fail(`unknown option ${name}`);
  }
  for (const name of ["npvbits", "npfbits", "wsbits"]) {
    if (!Number.isSafeInteger(options[name]) || options[name] < 0 || options[name] > 16) {
      fail(`${name} must be an integer between 0 and 16`);
    }
  }
  const { processes, accesses, npvbits, npfbits, wsbits, upto, policy } = options;
  if (!Array.isArray(processes) || !processes.length) fail("processes must be a non-empty array");
  const names = new Set();
  for (const process of processes) {
    if (typeof process !== "string" || !/^[a-z]+$/.test(process)) {
      fail("process names must contain only lowercase letters");
    }
    if (names.has(process)) fail(`duplicate process ${process}`);
    names.add(process);
  }
  if (policy !== "LRU" && policy !== "FIFO") fail("policy must be LRU or FIFO");
  if (wsbits > npvbits) fail("working set cannot exceed virtual pages per process");
  if (processes.length * Math.pow(2, wsbits) > Math.pow(2, npfbits)) {
    fail("physical pages must accommodate the working sets of all processes");
  }
  if (!Array.isArray(accesses) || !accesses.length) fail("accesses must be a non-empty array of {process, npv} mappings");
  if (!Number.isSafeInteger(upto) || upto < -1 || upto > accesses.length) {
    fail("upto must be an integer between -1 and the number of accesses");
  }
  // The rendered tables retain a snapshot for every access. Bound the whole
  // history before allocating any page table, not just each dimension alone.
  const cells = Math.pow(2, npfbits) + processes.length * Math.pow(2, npvbits);
  if (accesses.length > 10000 || cells * (accesses.length + 1) > 1000000) {
    fail("geometry and trace exceed the simulation limit (1000000 state cells, 10000 accesses)");
  }
  accesses.forEach((action, index) => {
    const label = `accesses[${index}]`;
    if (!action || typeof action !== "object" || Array.isArray(action)) fail(`${label} must be a {process, npv} mapping`);
    for (const name of Object.keys(action)) {
      if (name !== "process" && name !== "npv") fail(`${label}: unknown field ${name}`);
    }
    if (!names.has(action.process)) fail(`${label}.process must name a declared process`);
    if (!Number.isSafeInteger(action.npv) || action.npv < 0 || action.npv >= Math.pow(2, npvbits)) {
      fail(`${label}.npv must be an integer between 0 and ${Math.pow(2, npvbits) - 1}`);
    }
  });
  return {
    system: { npvbits, npfbits, wsbits, policy },
    processes: _.fromPairs(processes.map(process => [process, { valid: true }])),
    accesses,
    limit: upto
  };
}

function generateSimulation(options) {
  return generateArtifacts(validateOptions(options));
}

module.exports = { generateSimulation, generateArtifacts, simulate, validateOptions };
