#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, spawnSync } = require("child_process");

const SUBNAME = "rv-exec";
const IMAGE = "vzpac-rv-exec:latest";

const DOCKERFILE = `FROM debian:12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc-riscv64-linux-gnu libc6-dev-riscv64-cross qemu-user-static && \\
    rm -rf /var/lib/apt/lists/*
WORKDIR /work
`;

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

function ensureImage(opts) {
  try {
    execSync(`docker image inspect ${IMAGE}`, { stdio: "ignore" });
    if (opts.verbose) console.error(`[rv-exec] image ${IMAGE} present`);
    return;
  } catch {}
  if (opts.verbose) console.error(`[rv-exec] building image ${IMAGE}…`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rv-exec-build-"));
  fs.writeFileSync(path.join(tmp, "Dockerfile"), DOCKERFILE);
  const r = spawnSync("docker", ["build", "-t", IMAGE, tmp], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("docker build failed");
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

  ensureImage(opts);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rv-exec-run-"));
  fs.writeFileSync(path.join(tmp, "harness.c"), genHarness(initSrc, globals));
  fs.writeFileSync(path.join(tmp, "prog.s"), wrapAsm(progSrc));

  const cmd = [
    "riscv64-linux-gnu-gcc -static -no-pie -O0 /work/harness.c /work/prog.s -o /work/exe",
    "qemu-riscv64-static /work/exe"
  ].join(" && ");

  const r = spawnSync("docker",
    ["run", "--rm", "-v", `${tmp}:/work`, IMAGE, "bash", "-c", cmd],
    { stdio: ["ignore", "pipe", "inherit"] }
  );

  if (opts.keep) {
    console.error(`[rv-exec] artifacts kept at ${tmp}`);
  } else {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  if (r.status !== 0) process.exit(r.status || 1);
  process.stdout.write(r.stdout);
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
