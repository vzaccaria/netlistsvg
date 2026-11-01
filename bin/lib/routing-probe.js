#!/usr/bin/env node
"use strict";

// Routing feasibility probe for ADR-0002 (bead netlistsvg-sp2.2).
// Registers a representative subset of canonical three-word commands next to
// their legacy forms on the installed Caporal 0.8, plus the pre-parser guard
// that vzpac.js will need for `help legacy` and unknown canonical paths.
// This is a test fixture only: it is not wired into vzpac.js or package bins.
//
// Guard semantics (ADR-0002 §Help/routing):
// - argv words that extend a known command (canonical or legacy) are that
//   command's arguments and must reach Caporal;
// - a strict prefix of a CANONICAL command is a valid group/object: help,
//   exit 0. A strict prefix of a legacy-only command (e.g. bare `pipe`) is
//   an unknown path: exit 2;
// - `help legacy` prints the alias table; `help <unknown path>` exits 2;
// - a leading global flag stops word collection, so `--quiet <path>` skips
//   the guard and keeps today's Caporal behavior. Bead .3 decides whether
//   the real registry also skips known global flags before the path.

const CANONICAL = [
  ["isa", "programs", "generate"],
  ["isa", "functions", "emit"],
  ["cpu", "pipeline", "simulate"],
  ["memory", "cache", "simulate"],
  ["memory", "cache-classic", "simulate"],
  ["os", "scheduling", "simulate"]
];

const LEGACY = [
  ["isa", "exercises"],
  ["memory", "exercises"],
  ["pipe", "pipesim"],
  ["sched"]
];

function extendsCommand(words, command) {
  return command.every((token, i) => words[i] === token);
}

function strictPrefix(words, command) {
  return (
    words.length < command.length &&
    words.every((token, i) => command[i] === token)
  );
}

function knownPath(words) {
  if (words.length === 0) {
    return true;
  }
  if (
    CANONICAL.concat(LEGACY).some(command => extendsCommand(words, command))
  ) {
    return true;
  }
  return CANONICAL.some(command => strictPrefix(words, command));
}

function commandWords(tokens) {
  const words = [];
  for (const token of tokens) {
    if (token.startsWith("-")) {
      break;
    }
    words.push(token);
  }
  return words;
}

function guard(argv) {
  if (argv[0] === "help") {
    if (argv[1] === "legacy") {
      console.log("LEGACY-TABLE");
      process.exit(0);
    }
    const words = commandWords(argv.slice(1));
    if (!knownPath(words)) {
      console.error(`error: unknown command: ${words.join(" ")}`);
      process.exit(2);
    }
    return;
  }
  const words = commandWords(argv);
  if (!knownPath(words)) {
    console.error(`error: unknown command: ${words.join(" ")}`);
    process.exit(2);
  }
}

guard(process.argv.slice(2));

const prog = require("caporal");

function hit(name) {
  return (args, options) =>
    console.log(
      `HIT ${name} args=${JSON.stringify(args)} options=${JSON.stringify({
        format: options.format,
        seed: options.seed
      })}`
    );
}

function singleFormat(allowed) {
  return value => {
    if (value !== allowed) {
      throw new Error(`format must be ${allowed}`);
    }
    return value;
  };
}

prog.version("0.0.1");
prog
  .command("isa exercises", "legacy collection")
  .argument("<yml>", "collection YAML")
  .action(hit("legacy-isa-exercises"));
prog
  .command("isa programs generate", "canonical collection")
  .argument("<yml>", "collection YAML")
  .action(hit("isa-programs-generate"));
prog
  .command("isa functions emit", "canonical emit")
  .argument("<json>", "function JSON")
  .option("--format <format>", "output format", singleFormat("asm"), "asm")
  .action(hit("isa-functions-emit"));
prog
  .command("pipe pipesim", "legacy simulator")
  .argument("<program>", "instruction list")
  .action(hit("legacy-pipe-pipesim"));
prog
  .command("cpu pipeline simulate", "canonical simulator")
  .argument("<program>", "instruction list")
  .action(hit("cpu-pipeline-simulate"));
prog
  .command("memory exercises", "legacy collection")
  .argument("<yml>", "collection YAML")
  .action(hit("legacy-memory-exercises"));
prog
  .command("memory cache simulate", "canonical bounded engine")
  .option("--seed <value>", "generation seed")
  .action(hit("memory-cache-simulate"));
prog
  .command("memory cache-classic simulate", "canonical classic engine")
  .argument("<alist>", "binary address list")
  .action(hit("memory-cache-classic-simulate"));
prog
  .command("os scheduling simulate", "canonical scheduler")
  .argument("[json]", "scheduler input")
  .action(hit("os-scheduling-simulate"));
prog
  .command("sched", "legacy parent dispatch")
  .argument("[json]", "scheduler input")
  .argument("[yaml]", "collection YAML")
  .action(hit("legacy-sched"));

prog.parse(process.argv);
