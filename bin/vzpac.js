#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const pkg = require("../package.json");

prog
  .version(pkg.version || "0.0.0")
  .description("vzpac — unified entry point for the vz-* didactic CLIs");

const modules = [
  "./vz-netlist",
  "./vz-sched",
  "./vz-pipe",
  "./vz-cache",
  "./vz-mmu",
  "./vz-memmap",
  "./vz-fsm",
  "./vz-quine",
  "./vz-wave",
  "./vz-rv-fcall",
  "./vz-nomnom",
  "./vz-compile-artifacts",
  "./vz-gen-assets",
  "./vz-rv-exec"
];

modules.forEach(m => {
  const mod = require(m);
  if (typeof mod.register === "function") {
    mod.register(prog);
  }
});

if (require.main === module) {
  prog.parse(process.argv);
}

module.exports = { register: p => modules.forEach(m => require(m).register(p)) };
