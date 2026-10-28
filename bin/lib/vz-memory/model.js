"use strict";

const { log2Exact } = require("../vz-cache/config");
const RELATIONS = {
  le: { operator: "\\le", hitOperator: "\\ge" },
  lt: { operator: "<", hitOperator: ">" },
  ge: { operator: "\\ge", hitOperator: "\\le" },
  gt: { operator: ">", hitOperator: "<" }
};

function fail(message) { throw new Error(message); }
function keys(options, allowed) {
  for (const key of Object.keys(options)) {
    if (!allowed.includes(key)) fail(`unknown option ${key}`);
  }
}
function nonnegative(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(`${label} must be a finite non-negative number`);
  }
}

function latency(options) {
  keys(options, ["kind", "eta", "nu", "unit", "target", "relation"]);
  nonnegative(options.eta, "eta");
  nonnegative(options.nu, "nu");
  if (options.nu === 0) fail("nu must be positive");
  if (typeof options.unit !== "string" || !options.unit.trim()) fail("unit must be a non-empty string");
  const target = options.target === "cacheless" ? options.nu : options.target;
  nonnegative(target, "target");
  if (!Object.prototype.hasOwnProperty.call(RELATIONS, options.relation)) fail("relation must be le, lt, ge or gt");
  // Group the cacheless comparison first: eta + nu - nu otherwise loses eta
  // when it is small relative to nu, and can introduce display artifacts.
  const threshold = (options.eta + (options.nu - target)) / options.nu;
  if (!Number.isFinite(threshold)) fail("latency threshold must be finite");
  return { values: Object.assign({
    eta: options.eta, nu: options.nu, unit: options.unit, target,
    threshold, rhoDomain: "0 \\le \\rho \\le 1"
  }, RELATIONS[options.relation]) };
}

function binarySize(bytes) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let index = 0;
  while (bytes >= 1024 && index < units.length - 1) { bytes /= 1024; index++; }
  return `${bytes}${units[index]}`;
}
function address(options) {
  keys(options, ["kind", "memoryBytes", "cacheBytes", "wordBits", "blockBytes"]);
  const membits = log2Exact("memoryBytes", options.memoryBytes);
  const cachebits = log2Exact("cacheBytes", options.cacheBytes);
  const blockbits = log2Exact("blockBytes", options.blockBytes);
  if (options.cacheBytes > options.memoryBytes) fail("cacheBytes must not exceed memoryBytes");
  if (options.blockBytes > options.cacheBytes) fail("blockBytes must not exceed cacheBytes");
  if (!Number.isSafeInteger(options.wordBits) || options.wordBits < 8 || options.wordBits % 8 !== 0) {
    fail("wordBits must be a positive whole number of bytes");
  }
  const wordsPerBlock = options.blockBytes / (options.wordBits / 8);
  if (!Number.isSafeInteger(wordsPerBlock) || wordsPerBlock < 1) fail("a block must contain a whole positive number of words");
  const indexbits = cachebits - blockbits;
  const tagbits = membits - cachebits;
  if (tagbits <= 0) fail("address geometry must have a positive tag width");
  return {
    values: {
      memoryBytes: options.memoryBytes, cacheBytes: options.cacheBytes,
      wordBits: options.wordBits, blockBytes: options.blockBytes,
      memorySize: binarySize(options.memoryBytes), cacheSize: binarySize(options.cacheBytes),
      membits, blockbits, indexbits, tagbits,
      blocks: options.cacheBytes / options.blockBytes, wordsPerBlock
    },
    wave: [{ name: "bo", bits: blockbits }, { name: "ixc", bits: indexbits }, { name: "tag", bits: tagbits }]
  };
}

function generateModel(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) fail("generate must be a mapping");
  if (options.kind === "latency") return latency(options);
  if (options.kind === "address") return address(options);
  fail("kind must be latency or address");
}

module.exports = { generateModel };
