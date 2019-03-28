#!/usr/bin/env node
"use strict";

let _ = require("lodash");

let pipe = (ft, dc) => {
  return _.repeat("-", ft) + "F" + _.repeat("*", dc - ft - 1) + "DEMW";
};

let load = (name, d, s1) => {
  return ({ config, readypc, ready, table }) => {
    let canDecodeAt = Math.max(ready[s1], readypc + 1);
    let rdy = _.clone(ready);
    let tbl = _.clone(table);
    tbl.push({
      ins: `${name} $${d}, offset($${s1})`,
      pipe: pipe(
        readypc,
        canDecodeAt
      )
    });
    rdy[d] = canDecodeAt + (config.hasMemForwarding ? 2 : 3);
    let nextState = {
      readypc: canDecodeAt,
      ready: rdy,
      table: tbl,
      config
    };
    console.log(nextState);
    return nextState;
  };
};

let alu = (name, d, s1, s2) => {
  return ({ config, readypc, ready, table }) => {
    let canDecodeAt = Math.max(ready[s1], ready[s2], readypc + 1);
    let rdy = _.clone(ready);
    let tbl = _.clone(table);
    tbl.push({
      ins: `${name} $${d}, $${s1}, $${s2}`,
      pipe: pipe(
        readypc,
        canDecodeAt
      )
    });
    rdy[d] = canDecodeAt + (config.hasAluForwarding ? 1 : 3);
    let nextState = {
      readypc: canDecodeAt,
      ready: rdy,
      table: tbl,
      config
    };
    console.log(nextState);
    return nextState;
  };
};

let simulate = config => {
  let initialState = {
    ready: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // registrers
    readypc: 0,
    table: [],
    config
  };

  let run = program => {
    return _.reduce(program, (s, i) => i(s), initialState);
  };
  return run;
};

let _prg = [
  load("load", 2, 1),
  alu("and", 4, 2, 5),
  alu("or", 8, 2, 6),
  alu("add", 9, 4, 2)
];

let sim = simulate({ hasAluForwarding: true, hasMemForwarding: true })(_prg);
let table = _.join(_.map(sim.table, "pipe"), "\n");
console.log(table);
