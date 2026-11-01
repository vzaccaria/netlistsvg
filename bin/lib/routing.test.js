"use strict";

/* global describe, it */

// Reproducible routing proof for ADR-0002 (bead netlistsvg-sp2.2): canonical
// three-word commands must coexist with legacy forms on the installed
// Caporal 0.8, and the pre-parser guard must own `help legacy` and unknown
// canonical paths. Runs the routing-probe fixture in a child process because
// Caporal terminates the process on parse failures.

const { expect } = require("chai");
const childProcess = require("child_process");
const path = require("path");

const PROBE = path.resolve(__dirname, "routing-probe.js");

function run(args) {
  const result = childProcess.spawnSync(process.execPath, [PROBE, ...args], {
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

describe("ADR-0002 canonical routing on Caporal 0.8", () => {
  it("routes a legacy two-word command sharing the canonical group word", () => {
    const r = run(["isa", "exercises", "x.yml"]);
    expect(r.status).to.equal(0);
    expect(r.stdout).to.contain('HIT legacy-isa-exercises args={"yml":"x.yml"}');
  });

  it("routes the canonical three-word command under the same group", () => {
    const r = run(["isa", "programs", "generate", "x.yml"]);
    expect(r.status).to.equal(0);
    expect(r.stdout).to.contain('HIT isa-programs-generate args={"yml":"x.yml"}');
  });

  it("splits cache and cache-classic on the second word", () => {
    const bounded = run(["memory", "cache", "simulate", "--seed", "7"]);
    expect(bounded.status).to.equal(0);
    expect(bounded.stdout).to.contain("HIT memory-cache-simulate");
    expect(bounded.stdout).to.contain('"seed":"7"');

    const classic = run(["memory", "cache-classic", "simulate", "0101,0110"]);
    expect(classic.status).to.equal(0);
    expect(classic.stdout).to.contain(
      'HIT memory-cache-classic-simulate args={"alist":"0101,0110"}'
    );
  });

  it("keeps legacy parent dispatch reachable outside the groups", () => {
    const r = run(["sched", "in.json"]);
    expect(r.status).to.equal(0);
    expect(r.stdout).to.contain('HIT legacy-sched args={"json":"in.json"');
  });

  it("accepts options before and after positional arguments", () => {
    const after = run(["isa", "functions", "emit", "f.json", "--format", "asm"]);
    expect(after.status).to.equal(0);
    expect(after.stdout).to.contain('"format":"asm"');

    const before = run(["isa", "functions", "emit", "--format", "asm", "f.json"]);
    expect(before.status).to.equal(0);
    expect(before.stdout).to.contain('args={"json":"f.json"}');
  });

  it("ends option parsing at -- but keeps -- as a literal positional", () => {
    // micromist stops option parsing at `--`, yet keeps `--` itself in the
    // positional tail. Tokens after it are surplus positionals, never
    // options: callers needing literal leading-dash values must keep using
    // `--option=value`.
    const notParsed = run([
      "isa",
      "functions",
      "emit",
      "f.json",
      "--",
      "--format",
      "weird"
    ]);
    expect(notParsed.status).to.equal(2);
    expect(notParsed.stderr).to.contain("Wrong number of argument(s)");
    expect(notParsed.stderr).to.not.contain("format must be");

    const literal = run(["os", "scheduling", "simulate", "--"]);
    expect(literal.status).to.equal(0);
    expect(literal.stdout).to.contain('"json":"--"');
  });

  it("enforces the single-value --format contract through a validator", () => {
    const wrong = run(["isa", "functions", "emit", "f.json", "--format=weird"]);
    expect(wrong.status).to.equal(2);
    expect(wrong.stderr).to.contain("format");

    const repeated = run([
      "isa",
      "functions",
      "emit",
      "f.json",
      "--format",
      "asm",
      "--format",
      "asm"
    ]);
    expect(repeated.status).to.equal(2);
    expect(repeated.stderr).to.contain("Invalid value 'asm,asm' for option --format");
  });

  it("defaults --format to the only supported value", () => {
    const r = run(["isa", "functions", "emit", "f.json"]);
    expect(r.status).to.equal(0);
    expect(r.stdout).to.contain('"format":"asm"');
  });

  it("intercepts help legacy before Caporal", () => {
    const r = run(["help", "legacy"]);
    expect(r.status).to.equal(0);
    expect(r.stdout).to.contain("LEGACY-TABLE");
  });

  it("fails help on unknown paths but keeps help on known prefixes", () => {
    const unknown = run(["help", "pipe", "nonsense"]);
    expect(unknown.status).to.equal(2);
    expect(unknown.stderr).to.contain("unknown command: pipe nonsense");

    const known = run(["help", "isa"]);
    expect(known.status).to.equal(0);
    expect(known.stdout).to.contain("USAGE");
  });

  it("fails unknown top-level words and legacy action-less prefixes", () => {
    const word = run(["nonsense"]);
    expect(word.status).to.equal(2);
    expect(word.stderr).to.contain("unknown command: nonsense");

    // `pipe` has registered legacy commands but no action of its own and is
    // not a canonical group: ADR-0002 makes it an unknown path, while
    // `pipe pipesim` keeps routing.
    const prefix = run(["pipe"]);
    expect(prefix.status).to.equal(2);
    expect(prefix.stderr).to.contain("unknown command: pipe");

    const full = run(["pipe", "pipesim", "add(4,2,5)"]);
    expect(full.status).to.equal(0);
    expect(full.stdout).to.contain("HIT legacy-pipe-pipesim");
  });

  it("fails unknown canonical paths with exit 2, also with --help", () => {
    const plain = run(["isa", "nonsense"]);
    expect(plain.status).to.equal(2);
    expect(plain.stderr).to.contain("unknown command: isa nonsense");

    const help = run(["isa", "nonsense", "--help"]);
    expect(help.status).to.equal(2);
    expect(help.stderr).to.contain("unknown command: isa nonsense");
  });

  it("keeps valid group and object prefixes on help with exit 0", () => {
    const group = run(["isa"]);
    expect(group.status).to.equal(0);
    expect(group.stdout).to.contain("USAGE");

    const object = run(["isa", "programs"]);
    expect(object.status).to.equal(0);
    expect(object.stdout).to.contain("USAGE");

    // `cpu` exists only through canonical registrations in the fixture: it
    // must validate as a group even with no legacy command underneath.
    const canonicalOnly = run(["cpu"]);
    expect(canonicalOnly.status).to.equal(0);
    expect(canonicalOnly.stdout).to.contain("USAGE");
  });

  it("treats known commands as prefixes of argv, not the reverse", () => {
    // Regression for the guard predicate: extra tokens after a known command
    // are its arguments and must reach Caporal, not become unknown paths.
    const r = run(["memory", "exercises", "m.yml"]);
    expect(r.status).to.equal(0);
    expect(r.stdout).to.contain('HIT legacy-memory-exercises args={"yml":"m.yml"}');
  });
});
