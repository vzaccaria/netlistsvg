"use strict";

/* global describe, it */

// Canonical CLI surface of ADR-0002 (bead netlistsvg-sp2.3): aliases share
// the legacy Command objects, seven leaves are registered separately, and
// the vzpac guard owns root/prefix help, `help legacy` and unknown paths.
// Each test runs the real bin/vzpac.js in a child process.

const { expect } = require("chai");
const childProcess = require("child_process");
const path = require("path");

const VZPAC = path.resolve(__dirname, "..", "vzpac.js");
const RV_SPEC = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "riscv",
  "rv-rec-2par",
  "rv-fun-spec.json"
);
const MOORE = path.resolve(__dirname, "..", "fixtures", "fsm", "src", "moore.json");

function run(args) {
  const result = childProcess.spawnSync(process.execPath, [VZPAC, ...args], {
    encoding: "utf8"
  });
  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function expectSameOutput(canonical, legacy) {
  const a = run(canonical);
  const b = run(legacy);
  expect(a.status).to.equal(b.status);
  expect(a.stdout).to.equal(b.stdout);
  return a;
}

describe("ADR-0002 canonical vzpac surface", () => {
  it("shows only canonical groups on the root help", () => {
    for (const args of [[], ["--help"], ["help"]]) {
      const r = run(args);
      expect(r.status).to.equal(0);
      expect(r.stdout).to.contain("vzpac <dominio> <oggetto> <verbo>");
      for (const group of ["logic", "isa", "cpu", "memory", "os", "graphics", "build"]) {
        expect(r.stdout).to.contain(group);
      }
      expect(r.stdout).to.not.contain("rv-fcall");
    }
  });

  it("lists every mapping in help legacy", () => {
    const r = run(["help", "legacy"]);
    expect(r.status).to.equal(0);
    expect(r.stdout).to.contain("netlist");
    expect(r.stdout).to.contain("logic netlist render");
    expect(r.stdout).to.contain("isa functions emit --format asm");
    expect(r.stdout).to.contain("cache exercises");
    expect(r.stdout).to.contain("vz-cache.js");
    expect(r.stdout).to.contain("bin/vz-fcall.js");
  });

  it("fails unknown paths and action-less legacy prefixes with exit 2", () => {
    for (const args of [["nonsense"], ["pipe"], ["isa", "nonsense", "--help"], ["help", "pipe"]]) {
      const r = run(args);
      expect(r.status).to.equal(2);
      expect(r.stderr).to.contain("unknown command");
    }
  });

  it("prints group and object help for valid canonical prefixes", () => {
    const group = run(["isa"]);
    expect(group.status).to.equal(0);
    expect(group.stdout).to.contain("programs");
    expect(group.stdout).to.contain("functions");
    expect(group.stdout).to.contain("stack");

    const object = run(["memory", "cache"]);
    expect(object.status).to.equal(0);
    expect(object.stdout).to.contain("generate | configure | simulate");
  });

  it("shows the shared handler declarations on canonical leaf help", () => {
    const r = run(["isa", "programs", "generate", "--help"]);
    expect(r.status).to.equal(0);
    expect(r.stdout).to.contain("<yml>");
  });

  it("routes canonical aliases to the very same engine output", () => {
    expectSameOutput(
      ["cpu", "pipeline", "simulate", "add(4,2,5)"],
      ["pipe", "pipesim", "add(4,2,5)"]
    );
    expectSameOutput(
      ["memory", "cache", "simulate", "--seed", "42"],
      ["cache-new", "sim", "--seed", "42"]
    );
    expectSameOutput(
      ["memory", "cache-classic", "simulate", "11000010011011,10110100110000"],
      ["cache", "sim", "11000010011011,10110100110000"]
    );
    expectSameOutput(["logic", "combinational", "minimize", "1x01"], ["quine", "1x01"]);
  });

  it("keeps the two cache engines separate", () => {
    const bounded = run(["memory", "cache", "simulate", "--seed", "42"]);
    expect(bounded.status).to.equal(0);
    expect(bounded.stdout).to.contain('"simulation"');

    // The classic engine requires its positional address list.
    const classic = run(["memory", "cache-classic", "simulate"]);
    expect(classic.status).to.equal(2);
    expect(classic.stderr).to.contain("Wrong number of argument(s)");
  });

  it("emits assembly identical to rv-fcall asm, with --format guarded", () => {
    for (const section of ["full", "prologue", "body"]) {
      expectSameOutput(
        ["isa", "functions", "emit", RV_SPEC, "--section", section],
        ["rv-fcall", "asm", RV_SPEC, "--section", section]
      );
    }

    const wrong = run(["isa", "functions", "emit", RV_SPEC, "--format", "weird"]);
    expect(wrong.status).to.equal(2);
    expect(wrong.stderr).to.contain("Invalid value 'weird' for option --format");
  });

  it("prints the preambles through the emit leaves", () => {
    expectSameOutput(["cpu", "pipeline", "emit"], ["pipe", "preamble"]);
    expectSameOutput(["memory", "map", "emit"], ["memmap", "preamble"]);

    const wrong = run(["cpu", "pipeline", "emit", "--format", "weird"]);
    expect(wrong.status).to.equal(2);
  });

  it("synthesizes FSMs identically through logic fsm synthesize", () => {
    expectSameOutput(
      ["logic", "fsm", "synthesize", MOORE, "-w"],
      ["fsm", MOORE, "-w"]
    );
  });

  it("separates canonical collection leaves from the implicit dispatch", () => {
    // Canonical generate: collection options are required at parse time.
    const missing = run(["os", "scheduling", "generate", "x.yml"]);
    expect(missing.status).to.equal(2);
    expect(missing.stderr).to.contain("Missing option --output");

    const fsmMissing = run(["logic", "fsm", "generate", "x.yml"]);
    expect(fsmMissing.status).to.equal(2);
    expect(fsmMissing.stderr).to.contain("Missing option --output");

    // Canonical simulate: no second YAML positional, no exercises dispatch.
    const extra = run(["os", "scheduling", "simulate", "x.json", "extra"]);
    expect(extra.status).to.equal(2);
    expect(extra.stderr).to.contain("Wrong number of argument(s)");

    // Legacy implicit dispatch keeps its own diagnostics.
    const legacy = run(["sched", "exercises"]);
    expect(legacy.status).to.equal(2);
    expect(legacy.stderr).to.contain("sched exercises requires a YAML file");
  });

  it("keeps Caporal completion reachable and canonical", () => {
    const script = run(["completion", "bash"]);
    expect(script.status).to.equal(0);

    // Candidates come from the overridden completion builder: aliases are
    // proposed as canonical paths while custom leaves keep their own names.
    const probe = childProcess.spawnSync(
      process.execPath,
      [
        "-e",
        [
          'const prog = require("caporal");',
          `require(${JSON.stringify(VZPAC)});`,
          `require(${JSON.stringify(
            path.resolve(__dirname, "cli-map.js")
          )}).registerCanonical(prog);`,
          'prog._autocomplete._getPossibleCommands(null, "logic").then(c => console.log(c.join("\\n")));'
        ].join("\n")
      ],
      { encoding: "utf8", cwd: path.resolve(__dirname, "..") }
    );
    expect(probe.status).to.equal(0);
    expect(probe.stdout).to.contain("logic netlist render");
    expect(probe.stdout).to.contain("logic combinational minimize");
    expect(probe.stdout).to.contain("logic fsm synthesize");
    expect(probe.stdout).to.not.contain("quine:");
  });

  it("applies the diagnostics after leading global flags", () => {
    const unknown = run(["--quiet", "bogus"]);
    expect(unknown.status).to.equal(2);
    expect(unknown.stderr).to.contain("unknown command: bogus");

    const helpUnknown = run(["--help", "bogus"]);
    expect(helpUnknown.status).to.equal(2);

    const prefix = run(["--quiet", "logic"]);
    expect(prefix.status).to.equal(0);
    expect(prefix.stdout).to.contain("combinational");
  });
});
