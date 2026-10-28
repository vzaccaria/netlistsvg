"use strict";

const { generateArtifacts, initialTaskOrder } = require("./lib");
const MAX_TICKS = 4096;
const MAX_STATE_CELLS = 262144;

function fail(message) { throw new Error(message); }
function keys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be a mapping`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label}: unknown option ${key}`);
}
function number(value, label, minimum, inclusive = true) {
  if (typeof value !== "number" || !Number.isFinite(value) || (inclusive ? value < minimum : value <= minimum)) {
    fail(`${label} must be finite and ${inclusive ? ">=" : ">"} ${minimum}`);
  }
}
function onGrid(value, timer) {
  return Math.abs(value / timer - Math.round(value / timer)) < 1e-8;
}

function validate(schedule) {
  keys(schedule, ["timer", "runfor", "class", "tasks", "graphics", "initialrq"], "generate");
  number(schedule.timer, "timer", 0.001);
  if (!onGrid(schedule.timer, 0.001)) fail("timer must use the simulator's millisecond precision (at most three decimals)");
  number(schedule.runfor, "runfor", 0, false);
  const ticks = Math.ceil(schedule.runfor / schedule.timer) + 1;
  if (ticks > MAX_TICKS) fail(`schedule exceeds ${MAX_TICKS} retained timer samples`);
  keys(schedule.class, ["type", "latency", "mingran", "wgup"], "class");
  if (schedule.class.type !== "CFS") fail("class.type must be CFS");
  number(schedule.class.latency, "class.latency", 0, false);
  number(schedule.class.mingran, "class.mingran", 0);
  number(schedule.class.wgup, "class.wgup", 0);
  keys(schedule.graphics, ["vspace", "hspace", "barheight"], "graphics");
  for (const field of ["vspace", "hspace", "barheight"]) number(schedule.graphics[field], `graphics.${field}`, 0, false);
  if (!Array.isArray(schedule.tasks) || !schedule.tasks.length) fail("tasks must be a non-empty array");
  const indices = new Set();
  const names = new Set();
  let cells = schedule.tasks.length;
  for (const [position, task] of schedule.tasks.entries()) {
    const label = `tasks[${position}]`;
    keys(task, ["index", "name", "lambda", "start", "events", "vrt"], label);
    if (!Number.isSafeInteger(task.index) || task.index < 0 || task.index >= schedule.tasks.length || indices.has(task.index)) {
      fail(`${label}.index must be a unique row index in 0..${schedule.tasks.length - 1}`);
    }
    indices.add(task.index);
    if (typeof task.name !== "string" || !task.name.trim() || names.has(task.name)) fail(`${label}.name must be a unique non-empty string`);
    names.add(task.name);
    number(task.lambda, `${label}.lambda`, 0, false);
    number(task.start, `${label}.start`, 0);
    if (task.vrt !== undefined) number(task.vrt, `${label}.vrt`, -Infinity);
    if (!Array.isArray(task.events) || !task.events.length) fail(`${label}.events must be a non-empty array`);
    for (const [index, duration] of task.events.entries()) {
      number(duration, `${label}.events[${index}]`, 0, index % 2 === 1);
      // A CPU burst smaller than the remaining timer quantum never drains in
      // the native discrete machine. Arrival/wait deadlines instead round up.
      if (index % 2 === 0 && !onGrid(duration, schedule.timer)) fail(`${label}.events[${index}]: CPU bursts must be multiples of timer`);
    }
    cells += task.events.length;
  }
  if (ticks * cells > MAX_STATE_CELLS) fail(`schedule exceeds ${MAX_STATE_CELLS} retained state/event cells`);
  if (schedule.initialrq !== undefined) {
    if (!Array.isArray(schedule.initialrq)) fail("initialrq must be an array of task names or indices");
    const listed = new Set();
    for (const reference of schedule.initialrq) {
      const task = schedule.tasks.find(task => reference === task.name || reference === task.index);
      if (!task || listed.has(task.index)) fail("initialrq must identify existing tasks exactly once");
      listed.add(task.index);
    }
  }
}

function generateModel(schedule) {
  validate(schedule);
  const artifacts = generateArtifacts({}, schedule);
  const values = {
    timer: String(schedule.timer), runfor: String(schedule.runfor),
    latency: String(schedule.class.latency), mingran: String(schedule.class.mingran), wgup: String(schedule.class.wgup),
    taskCount: String(schedule.tasks.length),
    initialOrder: initialTaskOrder(schedule).map(task => task.name).join(" → "),
    wakeupCount: String(artifacts.conditions.filter(condition => condition.kind === "wakeup").length)
  };
  return { artifacts, values };
}

module.exports = { generateModel };
