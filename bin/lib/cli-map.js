"use strict";

// ADR-0002 central command registry: the canonical `vzpac <domain> <object>
// <verb>` surface next to the permanent silent legacy aliases.
//
// Mechanics on Caporal 0.8:
// - 1:1 renames reuse Command.alias(): the SAME Command object serves both
//   names, so arguments, options, defaults, validators and action are shared
//   by construction (no cloning, no forwarding subprocess).
// - Seven canonical leaves have a different signature from their legacy form
//   and are registered separately, reusing the exported module actions:
//   os scheduling simulate/generate and logic fsm synthesize/generate drop
//   the implicit `exercises` dispatch; the three emit leaves gain the
//   single-value --format option that aliases must not acquire.
// - `cache exercises` stays legacy-only: its canonical target is
//   `memory cache generate` (the memory handler), reached after input
//   conversion (ADR-0002 "Raccolte cache unificate").

const ALIASES = [
  { legacy: "netlist", canonical: "logic netlist render" },
  { legacy: "logic exercises", canonical: "logic combinational generate" },
  { legacy: "quine", canonical: "logic combinational minimize" },
  { legacy: "seq exercises", canonical: "logic sequential generate" },
  { legacy: "isa exercises", canonical: "isa programs generate" },
  { legacy: "rv-exec", canonical: "isa programs run" },
  { legacy: "rv-fcall exercises", canonical: "isa functions generate" },
  { legacy: "rv-fcall artifact", canonical: "isa functions render" },
  { legacy: "rv-fcall test", canonical: "isa functions test" },
  { legacy: "rv-fcall diagram", canonical: "isa stack render" },
  { legacy: "pipe exercises", canonical: "cpu pipeline generate" },
  { legacy: "pipe pipesim", canonical: "cpu pipeline simulate" },
  { legacy: "memory exercises", canonical: "memory cache generate" },
  { legacy: "cache-new config", canonical: "memory cache configure" },
  { legacy: "cache-new sim", canonical: "memory cache simulate" },
  { legacy: "cache sim", canonical: "memory cache-classic simulate" },
  { legacy: "mmu exercises", canonical: "memory paging generate" },
  { legacy: "mmu sim", canonical: "memory paging simulate" },
  { legacy: "memmap generate", canonical: "memory map render" },
  { legacy: "wave", canonical: "graphics waveform render" },
  { legacy: "sootty mask", canonical: "graphics waveform mask" },
  { legacy: "nomnom", canonical: "graphics diagram render" },
  { legacy: "gen-assets", canonical: "build assets generate" },
  { legacy: "compile-artifacts", canonical: "build artifacts compile" }
];

// Canonical leaves registered on their own (different signature).
const CUSTOM = [
  { legacy: "sched", canonical: "os scheduling simulate" },
  { legacy: "sched exercises", canonical: "os scheduling generate" },
  { legacy: "fsm", canonical: "logic fsm synthesize" },
  { legacy: "fsm exercises", canonical: "logic fsm generate" },
  {
    legacy: "rv-fcall asm",
    canonical: "isa functions emit",
    display: "isa functions emit --format asm"
  },
  {
    legacy: "pipe preamble",
    canonical: "cpu pipeline emit",
    display: "cpu pipeline emit --format latex-preamble"
  },
  {
    legacy: "memmap preamble",
    canonical: "memory map emit",
    display: "memory map emit --format latex-preamble"
  }
];

// Legacy forms whose canonical target is another legacy command's target.
const CONVERSIONS = [
  {
    legacy: "cache exercises",
    canonical: "memory cache generate",
    note: "conversione input: kind per istanza, slot %% memory-exercises %%"
  }
];

const GROUP_DESCRIPTIONS = {
  logic: "Reti combinatorie e sequenziali, FSM, netlist",
  isa: "Programmi, funzioni e stack a livello ISA",
  cpu: "Microarchitettura: pipeline",
  memory: "Cache, paginazione e mappe di memoria",
  os: "Scheduling",
  graphics: "Forme d'onda e diagrammi",
  build: "Asset e artefatti"
};

const BINS = [
  "vzpac", "netlistsvg", "vz-netlist", "vz-sched", "vz-compile-artifacts",
  "vz-wave", "vz-quine", "vz-pipe", "vz-pipe-new", "vz-fsm", "vz-memmap",
  "vz-nomnom", "vz-rv-fcall", "vz-cache.js", "vz-cache-new", "vz-mmu",
  "vz-gen-assets", "vz-rv-exec"
];

const WRAPPERS = [
  "node bin/vz-memory.js", "node bin/vz-logic.js", "node bin/vz-seq.js",
  "node bin/vz-isa.js", "node bin/vz-sootty.js"
];

const OUT_OF_SCOPE = ["bin/vz-fcall.js", "bin/vz-src.js", "bin/view.js"];

function words(path) {
  return path.split(" ").filter(w => !w.startsWith("-"));
}

function canonicalPaths() {
  return ALIASES.concat(CUSTOM).map(row => words(row.canonical));
}

function legacyPaths() {
  return ALIASES.concat(CUSTOM, CONVERSIONS).map(row => words(row.legacy));
}

function extendsCommand(argWords, command) {
  return command.every((token, i) => argWords[i] === token);
}

function strictPrefix(argWords, command) {
  return (
    argWords.length < command.length &&
    argWords.every((token, i) => command[i] === token)
  );
}

// Guard classification (proved by bin/lib/routing.test.js semantics):
// "run" reaches Caporal; "prefix" is a valid canonical group/object;
// "unknown" must fail with exit 2.
function classify(argWords) {
  if (argWords.length === 0) {
    return "run";
  }
  const known = canonicalPaths().concat(legacyPaths());
  if (known.some(command => extendsCommand(argWords, command))) {
    return "run";
  }
  if (canonicalPaths().some(command => strictPrefix(argWords, command))) {
    return "prefix";
  }
  return "unknown";
}

// Caporal globals the guard skips when collecting the command path, so the
// diagnostics apply after them too. NOTE: Caporal's tokenizer (micromist)
// treats the token after a leading flag as that flag's VALUE, so a leading
// global still prevents command execution (preexisting behavior for legacy
// forms as well; trailing flags work). -V/--version and any other dash
// token end word collection and fall back to Caporal's native handling.
const GLOBAL_FLAGS = new Set([
  "--quiet",
  "--silent",
  "--color",
  "--no-color",
  "-v",
  "--verbose"
]);

function commandWords(tokens) {
  const argWords = [];
  let help = false;
  for (const token of tokens) {
    if (GLOBAL_FLAGS.has(token)) {
      continue;
    }
    if (token === "-h" || token === "--help") {
      help = true;
      continue;
    }
    if (token.startsWith("-")) {
      break;
    }
    argWords.push(token);
  }
  return { argWords, help };
}

function pad(text, width) {
  return text + " ".repeat(Math.max(1, width - text.length));
}

function legacyHelp() {
  const rows = ALIASES.concat(CUSTOM, CONVERSIONS);
  const width = Math.max(...rows.map(r => r.legacy.length)) + 2;
  const lines = ["LEGACY -> CANONICO", ""];
  for (const row of rows) {
    const note = row.note ? `  (${row.note})` : "";
    lines.push(`  ${pad(row.legacy, width)}${row.display || row.canonical}${note}`);
  }
  lines.push("");
  lines.push("I prefissi legacy senza azione (es. `pipe`, `cache`) non sono comandi.");
  lines.push("");
  lines.push("BIN INSTALLATI (invariati): " + BINS.join(", "));
  lines.push("WRAPPER DIRETTI (invariati): " + WRAPPERS.join(", "));
  lines.push("FUORI SCOPE (nessun alias): " + OUT_OF_SCOPE.join(", "));
  return lines.join("\n");
}

function groupTree() {
  const tree = {};
  for (const row of ALIASES.concat(CUSTOM)) {
    const [group, object, verb] = words(row.canonical);
    tree[group] = tree[group] || {};
    tree[group][object] = tree[group][object] || [];
    if (!tree[group][object].includes(verb)) {
      tree[group][object].push(verb);
    }
  }
  return tree;
}

function rootHelp(binName) {
  const lines = [
    `${binName} <dominio> <oggetto> <verbo>`,
    "",
    "DOMINI",
    ""
  ];
  const groups = Object.keys(GROUP_DESCRIPTIONS);
  const width = Math.max(...groups.map(g => g.length)) + 2;
  for (const group of groups) {
    lines.push(`  ${pad(group, width)}${GROUP_DESCRIPTIONS[group]}`);
  }
  lines.push("");
  lines.push(`Dettagli: \`${binName} <dominio>\`; alias storici: \`${binName} help legacy\`.`);
  return lines.join("\n");
}

function prefixHelp(binName, argWords) {
  const tree = groupTree();
  const group = argWords[0];
  const lines = [`${binName} ${argWords.join(" ")} <...>`, ""];
  const objects =
    argWords.length === 1
      ? Object.keys(tree[group])
      : [argWords[1]].filter(object => tree[group][object]);
  const width = Math.max(...objects.map(o => o.length)) + 2;
  for (const object of objects) {
    lines.push(`  ${pad(object, width)}${tree[group][object].join(" | ")}`);
  }
  lines.push("");
  lines.push(`Help di una foglia: \`${binName} ${group} <oggetto> <verbo> --help\`.`);
  return lines.join("\n");
}

// Pre-parser guard: owns root help, `help legacy`, canonical prefix help and
// unknown-path diagnostics for the vzpac entry point only. Standalone bins
// and direct wrappers never call it. `completion` and -V/--version stay with
// Caporal.
function guard(argv, binName) {
  const name = binName || "vzpac";
  if (argv[0] === "completion") {
    return;
  }
  if (argv[0] === "help" && argv[1] === "legacy") {
    console.log(legacyHelp());
    process.exit(0);
  }
  const tokens = argv[0] === "help" ? argv.slice(1) : argv;
  const { argWords, help } = commandWords(tokens);
  if (argWords.length === 0) {
    if (argv.length === 0 || help || argv[0] === "help") {
      console.log(rootHelp(name));
      process.exit(0);
    }
    return;
  }
  const kind = classify(argWords);
  if (kind === "unknown") {
    console.error(`error: unknown command: ${argWords.join(" ")}`);
    console.error(`Type ${name} --help, or ${name} help legacy for old names.`);
    process.exit(2);
  }
  if (kind === "prefix") {
    console.log(prefixHelp(name, argWords));
    process.exit(0);
  }
}

function findCommand(prog, name) {
  const command = prog._commands.filter(c => c.name() === name)[0];
  if (!command) {
    throw new Error(`cli-map: legacy command not registered: ${name}`);
  }
  return command;
}

function singleFormat(allowed) {
  return value => {
    if (value !== allowed) {
      throw new Error(`format must be ${allowed}`);
    }
    return value;
  };
}

// Attach canonical names: aliases on the shared legacy Command objects plus
// the seven signature-changing leaves. Must run after every module has
// registered its legacy commands on `prog`.
function registerCanonical(prog) {
  for (const row of ALIASES) {
    findCommand(prog, row.legacy).alias(row.canonical);
  }

  const { addCompileOptions } = require("./artifacts");
  const sched = require("../vz-sched");
  const schedExercises = require("./vz-sched/exercises");
  const fsm = require("../vz-fsm");
  const fsmExercises = require("./vz-fsm/exercises");
  const rvFcall = require("../vz-rv-fcall");
  const pipe = require("../vz-pipe");
  const memmap = require("../vz-memmap");

  // Completion must propose the canonical paths while aliases stay
  // executable: map matched commands to their alias when one exists.
  const autocomplete = prog._autocomplete;
  autocomplete._getPossibleCommands = function(currentCommand, cmdStr) {
    const commands = this._program
      .getCommands()
      .filter(c => {
        if (typeof cmdStr !== "string") {
          return true;
        }
        return (
          (c.name().startsWith(cmdStr) ||
            (c.getAlias() && c.getAlias().startsWith(cmdStr))) &&
          (!currentCommand || !this._isSameCommand(c, currentCommand))
        );
      })
      .filter(c => c.name() !== "")
      .map(c => (c.getAlias() || c.name()) + ":" + c.description());
    return Promise.resolve(commands);
  };

  addCompileOptions(
    sched.addSimulateOptions(
      prog
        .command("os scheduling simulate", "CFS diagrams (canonico per sched)")
        .argument("[json]", "JSON file, stdin if omitted"),
      prog
    )
  ).action(sched.simulateAction);

  prog
    .command("os scheduling generate", "Generate scheduling exercises (canonico per sched exercises)")
    .argument("<yml>", "Scheduling instances YAML (paths are relative to this file)")
    .option("-o, --output <markdown>", "Generated Markdown chapter", undefined, undefined, true)
    .option("--manifest <yml>", "Combined gen-assets YAML", undefined, undefined, true)
    .action((args, options) =>
      schedExercises.generate(args.yml, options.output, options.manifest)
    );

  addCompileOptions(
    fsm.addSynthesizeOptions(
      prog
        .command("logic fsm synthesize", "FSM synthesis (canonico per fsm)")
        .argument("[json]", "JSON file, stdin if omitted"),
      prog
    )
  ).action(fsm.synthesizeAction);

  prog
    .command("logic fsm generate", "Generate FSM exercises (canonico per fsm exercises)")
    .argument("<yml>", "FSM instances YAML (paths are relative to this file)")
    .option("-o, --output <markdown>", "Generated Markdown chapter", undefined, undefined, true)
    .option("--manifest <yml>", "Combined gen-assets YAML", undefined, undefined, true)
    .action((args, options) =>
      fsmExercises.generate(args.yml, options.output, options.manifest)
    );

  prog
    .command("isa functions emit", "Emit callee assembly (canonico per rv-fcall asm)")
    .argument("<json>", "File describing the call sequence")
    .option("--format <format>", "Output format (only: asm)", singleFormat("asm"), "asm")
    .option("--section <s>", "Which section to emit: full | prologue | body | epilogue", prog.STRING, "full")
    .action(rvFcall.asmAction);

  prog
    .command("cpu pipeline emit", "Print latex preamble (canonico per pipe preamble)")
    .option("--format <format>", "Output format (only: latex-preamble)", singleFormat("latex-preamble"), "latex-preamble")
    .action(pipe.printPreamble);

  prog
    .command("memory map emit", "Print latex preamble (canonico per memmap preamble)")
    .option("--format <format>", "Output format (only: latex-preamble)", singleFormat("latex-preamble"), "latex-preamble")
    .action(memmap.printPreamble);
}

module.exports = {
  ALIASES,
  CUSTOM,
  CONVERSIONS,
  classify,
  commandWords,
  guard,
  legacyHelp,
  rootHelp,
  prefixHelp,
  registerCanonical
};
