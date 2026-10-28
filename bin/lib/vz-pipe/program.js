"use strict";

const OPERANDS = Object.freeze({
  add: ["d", "s1", "s2"], sub: ["d", "s1", "s2"], or: ["d", "s1", "s2"],
  lw: ["d", "s1"], sw: ["s1", "s2"], beq: ["s1", "s2"], nop: [], anything: []
});
const MAX_INSTRUCTIONS = 256;
const MAX_CYCLES = 4096;
const MAX_CELLS = 262144;

function fail(message) { throw new Error(`pipe: ${message}`); }
function mapping(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be a mapping`);
  return value;
}
function keys(value, allowed, label) {
  mapping(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label}: unknown field ${key}`);
}
function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${label} must be an integer between ${min} and ${max}`);
  return value;
}
function instructions(value) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_INSTRUCTIONS) fail(`instructions must contain 1..${MAX_INSTRUCTIONS} entries`);
  return value.map((row, index) => {
    mapping(row, `instructions[${index}]`);
    if (!Object.prototype.hasOwnProperty.call(OPERANDS, row.op)) fail(`instructions[${index}]: unknown operation`);
    const operands = OPERANDS[row.op];
    keys(row, ["op", ...operands], `instructions[${index}]`);
    const result = { op: row.op };
    for (const field of operands) result[field] = integer(row[field], 0, 31, `instructions[${index}].${field}`);
    return result;
  });
}

// Restricted grammar: source is never evaluated.
function parseProgram(source) {
  if (Array.isArray(source)) return instructions(source);
  if (typeof source !== "string" || source.length > 65536) fail("program must be a bounded instruction string or structured array");
  if (source.trim().startsWith("[")) {
    let parsed;
    try { parsed = JSON.parse(source); } catch (error) { fail("invalid structured program JSON"); }
    return instructions(parsed);
  }
  let position = 0;
  const rows = [];
  function space() { while (/\s/.test(source[position] || "") && position < source.length) position++; }
  function token(pattern) {
    space();
    const match = source.slice(position).match(pattern);
    if (!match) fail(`invalid program syntax at character ${position}`);
    position += match[0].length;
    return match[0];
  }
  space();
  while (position < source.length) {
    const op = token(/^[A-Za-z]+/);
    if (!Object.prototype.hasOwnProperty.call(OPERANDS, op)) fail(`unknown operation ${op}`);
    const args = [];
    let calls = 0;
    space();
    while (source[position] === "(") {
      position++;
      calls++;
      if (args.length >= OPERANDS[op].length && calls > 1) fail(`${op}: too many calls`);
      space();
      if (source[position] === ")" && OPERANDS[op].length) fail(`${op}: empty register call`);
      if (source[position] !== ")") {
        args.push(Number(token(/^\d+/)));
        space();
        while (source[position] === ",") {
          position++;
          args.push(Number(token(/^\d+/)));
          space();
        }
      }
      token(/^\)/);
      space();
    }
    if (!calls || args.length !== OPERANDS[op].length) fail(`${op} requires ${OPERANDS[op].length} register arguments`);
    const row = { op };
    OPERANDS[op].forEach((field, index) => { row[field] = args[index]; });
    rows.push(row);
    if (rows.length > MAX_INSTRUCTIONS) fail("too many instructions");
    if (position === source.length) break;
    token(/^,/);
    space();
    if (position === source.length) fail("trailing instruction separator");
  }
  return instructions(rows);
}

function serializeProgram(rows) {
  return instructions(rows).map(row => `${row.op}${OPERANDS[row.op].length ? OPERANDS[row.op].map(field => `(${row[field]})`).join("") : "()"}`).join(",");
}

function conflictString(value, count) {
  if (value === undefined || value === "") return value;
  const stage = endpoint => {
    keys(endpoint, ["instruction", "stage"], "conflict endpoint");
    integer(endpoint.instruction, 0, count - 1, "conflict instruction");
    if (!/^[idemw]$/.test(endpoint.stage)) fail("conflict stage must be i, d, e, m or w");
    return `${endpoint.stage}${endpoint.instruction}`;
  };
  if (typeof value === "string") {
    value = value.split(",").map(item => {
      const match = item.match(/^([cdf])([idemw])(\d+)([idemw])(\d+)$/);
      if (!match) fail("invalid conflict annotation");
      return { type: match[1], from: { stage: match[2], instruction: Number(match[3]) }, to: { stage: match[4], instruction: Number(match[5]) } };
    });
  }
  if (!Array.isArray(value) || value.length > 1024) fail("conflicts must be a bounded array");
  return value.map(row => {
    keys(row, ["type", "from", "to"], "conflict");
    if (!["c", "d", "f"].includes(row.type)) fail("conflict type must be c, d or f");
    if (row.type === "f" && row.from && row.from.stage === "w") fail("forwarding source must have a pipeline-latch anchor (i, d, e or m)");
    return row.type + stage(row.from) + stage(row.to);
  }).join(",");
}

function normalizeOptions(raw, count) {
  mapping(raw, "options");
  const result = Object.assign({}, raw);
  for (const field of ["fw", "branchopt", "branchpred", "isLoop", "noInstructions", "blank", "debug"]) {
    if (raw[field] !== undefined && typeof raw[field] !== "boolean") fail(`${field} must be boolean`);
    if (raw[field] === false) delete result[field];
  }
  for (const field of ["maxCycles", "asmIns"]) {
    if (raw[field] !== undefined) {
      const value = typeof raw[field] === "string" && /^\d+$/.test(raw[field]) ? Number(raw[field]) : raw[field];
      result[field] = integer(value, field === "asmIns" ? 0 : 1, field === "asmIns" ? count : MAX_CYCLES, field);
    }
  }
  const separation = raw.hrowsep === undefined ? 1.3 :
    typeof raw.hrowsep === "string" && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.hrowsep) ? Number(raw.hrowsep) : raw.hrowsep;
  if (typeof separation !== "number" || !Number.isFinite(separation) || separation <= 0 || separation > 100) fail("hrowsep must be finite and in (0, 100]");
  result.hrowsep = separation;
  result.conflicts = conflictString(raw.conflicts, count);
  return result;
}

module.exports = { OPERANDS, MAX_INSTRUCTIONS, MAX_CYCLES, MAX_CELLS, fail, keys, integer, instructions, parseProgram, serializeProgram, normalizeOptions };
