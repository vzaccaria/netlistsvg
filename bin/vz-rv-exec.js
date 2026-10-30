#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { executeNative } = require("./lib/rv-native");

const SUBNAME = "rv-exec";

function parseGlobals(src) {
  const out = [];
  const lines = src.split(/\n/);
  for (const line of lines) {
    let m;
    if ((m = line.match(/^\s*uint64_t\s+(\w+)\s*\[\s*(\d+)\s*\]/))) {
      out.push({ name: m[1], kind: "array", size: parseInt(m[2], 10) });
    } else if ((m = line.match(/^\s*uint64_t\s+(\w+)\s*[=;]/))) {
      out.push({ name: m[1], kind: "scalar" });
    }
  }
  return out;
}

function genHarness(initSrc, globals) {
  const prints = globals.map(g => {
    if (g.kind === "array") {
      const fmt = Array(g.size).fill("%lu").join(", ");
      const args = Array.from({ length: g.size }, (_, i) => `${g.name}[${i}]`).join(", ");
      return `  printf("uint64_t ${g.name}[${g.size}] = {${fmt}};\\n", ${args});`;
    }
    return `  printf("uint64_t ${g.name} = %lu;\\n", ${g.name});`;
  }).join("\n");

  const cleaned = initSrc.replace(/#include\s*<[^>]+>\s*\n/g, "");
  return `#include <stdio.h>
#include <stdint.h>

${cleaned}
extern void f(void);

int main(void) {
${prints}
  f();
  printf("--- after f() ---\\n");
${prints}
  return 0;
}
`;
}

function wrapAsm(src) {
  return `.text
.globl f
.type f, @function
${src}
    ret
.size f, .-f
`;
}


function run(args, opts) {
  const progPath = path.resolve(args.prog);
  const initPath = path.resolve(args.init);
  const initSrc = fs.readFileSync(initPath, "utf8");
  const progSrc = fs.readFileSync(progPath, "utf8");
  const globals = parseGlobals(initSrc);

  if (opts.verbose) {
    console.error(`[rv-exec] globals: ${globals.map(g => g.kind === "array" ? `${g.name}[${g.size}]` : g.name).join(", ")}`);
  }

  const [result] = executeNative({
    "harness.c": genHarness(initSrc, globals),
    "prog.s": wrapAsm(progSrc)
  }, [{ sources: ["harness.c", "prog.s"] }], opts);
  if (result.stderr) process.stderr.write(result.stderr);
  process.stdout.write(result.stdout);
}

const register = prog => {
  prog
    .command(SUBNAME, "Run a RISC-V function body against initial globals via qemu-user")
    .argument("<prog>", "Path to rv-prog.s (body without prologue/epilogue)")
    .argument("<init>", "Path to rv-init.c (defines globals with initial values)")
    .option("-v, --verbose", "Verbose output")
    .option("-k, --keep", "Keep tmp build artifacts (printed on stderr)")
    .action((args, options) => run(args, options));
};

module.exports = { register };

if (require.main === module) {
  const prog = require("caporal");
  register(prog);
  prog.parse([process.argv[0], process.argv[1], SUBNAME, ...process.argv.slice(2)]);
}
