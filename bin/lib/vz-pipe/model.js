"use strict";

const { run, generateArtifacts } = require("./lib");
const { MAX_INSTRUCTIONS, fail, keys, integer, instructions, serializeProgram, normalizeOptions } = require("./program");
const POLICIES = ["fw", "branchopt", "branchpred"];
const OPTIONS = [...POLICIES, "maxCycles", "isLoop", "asmIns", "noInstructions", "hrowsep", "conflicts"];
const format = value => Number(value.toFixed(2)).toString();

function expand(body, repeat) {
  if (body.length * repeat > MAX_INSTRUCTIONS) fail(`expanded program exceeds ${MAX_INSTRUCTIONS} instructions`);
  const result = [];
  for (let iteration = 0; iteration < repeat; iteration++) result.push(...body);
  return result;
}

function steadyPeriod(body, options) {
  // Completion, not speculative fetch, identifies the true iteration period.
  const repeats = Math.min(8, Math.floor(MAX_INSTRUCTIONS / body.length));
  if (repeats < 4) fail("loop body is too large to establish a stable completion period");
  const policy = {};
  for (const field of POLICIES) if (options[field] !== undefined) policy[field] = options[field];
  const state = run(policy, expand(body, repeats));
  const table = state.table;
  let period;
  for (let iteration = repeats - 3; iteration < repeats; iteration++) {
    for (let instruction = 0; instruction < body.length; instruction++) {
      const index = iteration * body.length + instruction;
      const delta = table[index].n_we - table[index - body.length].n_we;
      if (period === undefined) period = delta;
      else if (period !== delta) fail("loop has no stable corresponding-instruction completion period");
    }
  }
  if (period < body.length) fail("invalid loop completion period");
  const previous = run(policy, expand(body, repeats - 1));
  // Once all live readiness constraints repeat up to a positive time shift,
  // the deterministic state machine repeats forever. Expired constraints
  // cannot bind a future stage and are clamped at the next fetch lower bound.
  const reference = state.ready[34];
  const previousReference = previous.ready[34];
  if (reference - previousReference !== period ||
      state.ready.some((time, index) => Math.max(0, time - reference) !==
        Math.max(0, previous.ready[index] - previousReference))) {
    fail("loop readiness has not reached a translation-invariant steady state");
  }
  // Resolution gate relative to execute: the following decode must wait one
  // additional cycle. Remaining lost cycles are register/data interlocks.
  const branchStalls = table.slice(-body.length).reduce((total, row, index) =>
    total + (body[index].op === "beq" ? row.n_pc - row.n_ee + 1 : 0), 0);
  if (period - body.length < branchStalls) fail("loop stalls cannot be separated into data and control interlocks");
  return { period, branchStalls };
}

function generateModel(raw) {
  keys(raw, ["instructions", "repeat", "comparison", "frequencyMHz", ...OPTIONS], "generate");
  const body = instructions(raw.instructions);
  const repeat = raw.repeat === undefined ? 1 : integer(raw.repeat, 1, MAX_INSTRUCTIONS, "repeat");
  const program = expand(body, repeat);
  if (raw.conflicts !== undefined && !Array.isArray(raw.conflicts)) fail("generate.conflicts must be an array");
  for (const field of ["maxCycles", "asmIns", "hrowsep"]) {
    if (raw[field] !== undefined && typeof raw[field] !== "number") fail(`generate.${field} must be numeric`);
  }
  const selected = {};
  for (const field of OPTIONS) if (raw[field] !== undefined) selected[field] = raw[field];
  const options = normalizeOptions(selected, program.length);
  const frequencyMHz = raw.frequencyMHz === undefined ? 600 : raw.frequencyMHz;
  if (typeof frequencyMHz !== "number" || !Number.isFinite(frequencyMHz) || frequencyMHz <= 0 || frequencyMHz > 1000000) fail("frequencyMHz must be finite and in (0, 1000000]");
  let comparison;
  if (raw.comparison !== undefined) {
    keys(raw.comparison, POLICIES, "comparison");
    comparison = normalizeOptions(Object.assign({}, options, raw.comparison), program.length);
  }
  const artifacts = generateArtifacts(options, program);
  const table = artifacts.state.table;
  const latency = table[table.length - 1].n_we - table[0].n_fe + 1;
  const bodyTable = table.slice(0, body.length);
  const isLoop = body.some(row => row.op === "beq") || options.isLoop;
  const asm = (isLoop ? "lab:\n" : "") + bodyTable.map(row =>
    row.ins.replace(/, lab\(/, ", 0(").replace(/, loop$/, ", lab")).join("\n");
  const metrics = {
    instructionsPerIteration: body.length, iterations: repeat, instructionCount: program.length,
    latency, finiteCpi: latency / program.length, frequencyMHz, finiteMips: frequencyMHz * program.length / latency
  };
  if (repeat > 1 && body[body.length - 1].op === "beq") {
    const { period, branchStalls } = steadyPeriod(body, options);
    metrics.stallsPerIteration = period - body.length;
    metrics.branchStalls = branchStalls;
    metrics.dataStalls = metrics.stallsPerIteration - branchStalls;
    metrics.cpi = period / body.length;
    metrics.asymptoticMips = frequencyMHz / metrics.cpi;
    if (comparison) {
      const other = steadyPeriod(body, comparison);
      const otherPeriod = other.period;
      metrics.comparisonStalls = otherPeriod - body.length;
      metrics.comparisonBranchStalls = other.branchStalls;
      metrics.comparisonDataStalls = metrics.comparisonStalls - other.branchStalls;
      metrics.comparisonCpi = otherPeriod / body.length;
      metrics.speedupPercent = Math.trunc((period - otherPeriod) * 100 / otherPeriod);
    }
  } else if (comparison) {
    fail("comparison requires repeat > 1 and a loop body ending in beq");
  }
  const values = { asm, architecture: artifacts.latex.find(artifact => artifact.sfx === "description").code, latencyOverhead: "4" };
  if (comparison) {
    values.comparisonArchitecture = generateArtifacts(comparison, program).latex.find(artifact => artifact.sfx === "description").code;
  }
  for (const [key, value] of Object.entries(metrics)) values[key] = format(value);
  return { artifacts, values, metrics, options, program: serializeProgram(program) };
}

module.exports = { generateModel };
