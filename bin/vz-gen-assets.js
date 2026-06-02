#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const yaml = require("js-yaml");

const SUBNAME = "gen-assets";
const STAMP = ".assets-stamp";

function interp(str, vars) {
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function interpDeep(node, vars) {
  if (typeof node === "string") return interp(node, vars);
  if (Array.isArray(node)) return node.map(n => interpDeep(n, vars));
  if (node && typeof node === "object") {
    const o = {};
    for (const [k, v] of Object.entries(node)) o[k] = interpDeep(v, vars);
    return o;
  }
  return node;
}

function serializeInput(filename, content) {
  if (typeof content === "string") return content;
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".json") return JSON.stringify(content, null, 2) + "\n";
  if (ext === ".yml" || ext === ".yaml") return yaml.dump(content);
  return String(content);
}

function hashEntry(entry) {
  return crypto.createHash("sha256").update(JSON.stringify(entry)).digest("hex");
}

function processEntry(qdir, entry, opts) {
  if (entry === "manual" || (entry && entry.manual)) return "skip";
  if (!entry || (!entry.steps && !entry.inputs)) return "skip";

  const stampPath = path.join(qdir, STAMP);
  const h = hashEntry(entry);
  if (!opts.force && fs.existsSync(stampPath) && fs.readFileSync(stampPath, "utf8").trim() === h) {
    return "cached";
  }

  fs.mkdirSync(qdir, { recursive: true });
  fs.mkdirSync(path.join(qdir, "assets"), { recursive: true });

  const vars = Object.assign({ qdir }, entry.vars || {});

  if (entry.inputs) {
    for (const [fname, raw] of Object.entries(entry.inputs)) {
      const expanded = interpDeep(raw, vars);
      const body = serializeInput(fname, expanded);
      fs.writeFileSync(path.join(qdir, fname), body);
    }
  }

  for (const step of entry.steps || []) {
    const cmd = interp(step, vars);
    if (opts.verbose) console.error(`[${qdir}] $ ${cmd}`);
    execSync(cmd, { stdio: "inherit", shell: "/bin/bash" });
  }

  fs.writeFileSync(stampPath, h + "\n");
  return "built";
}

function cleanEntry(qdir, entry) {
  if (entry === "manual" || (entry && entry.manual)) return;
  if (!entry) return;
  if (fs.existsSync(qdir)) fs.rmSync(qdir, { recursive: true, force: true });
}

function run(ymlPath, opts) {
  const abs = path.resolve(ymlPath);
  const root = path.dirname(abs);
  const doc = yaml.load(fs.readFileSync(abs, "utf8")) || {};

  for (const [qdir, entry] of Object.entries(doc)) {
    const isActionable =
      entry && typeof entry === "object" &&
      (entry.steps || entry.inputs || entry.cleanup || entry.manual);
    if (!isActionable) continue;
    const full = path.join(root, qdir);
    if (opts.clean) {
      cleanEntry(full, entry);
      console.error(`[${qdir}] cleaned`);
      continue;
    }
    const r = processEntry(full, entry, opts);
    console.error(`[${qdir}] ${r}`);
  }
}

let register = prog => {
  prog
    .command(SUBNAME, "Generate per-question exam assets from a single YAML SSOT")
    .argument("<yml>", "Path to assets.yml")
    .option("-f, --force", "Force rebuild, ignore stamp")
    .option("-c, --clean", "Remove generated assets and materialized inputs")
    .option("-v, --verbose", "Print each command")
    .action((args, options) => run(args.yml, options));
};

module.exports = { register };

if (require.main === module) {
  const prog = require("caporal");
  register(prog);
  prog.parse([process.argv[0], process.argv[1], SUBNAME, ...process.argv.slice(2)]);
}
