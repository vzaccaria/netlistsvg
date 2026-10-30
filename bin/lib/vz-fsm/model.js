"use strict";

const { createFSMArtifacts, getTransition } = require("../fsm");
const FLIP_FLOPS = { D: ["D"], SR: ["S", "R"], T: ["T"], JK: ["J", "K"] };
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function fail(message) { throw new Error(message); }
function mapping(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be a mapping`);
  return value;
}
function keys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label}: unknown option ${key}`);
}
function integer(value, label, maximum) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) fail(`${label} must be an integer between 1 and ${maximum}`);
}
function text(value, label) {
  if (typeof value !== "string" || !value.trim() || value.length > 4096) fail(`${label} must be a non-empty string of at most 4096 characters`);
}
function bits(value, size, label) {
  if (!Array.isArray(value) || value.length !== size || value.some(bit => bit !== 0 && bit !== 1)) fail(`${label} must contain exactly ${size} numeric bits`);
}
function singleKey(value, label) {
  mapping(value, label);
  const names = Object.keys(value);
  if (names.length !== 1) fail(`${label} must contain exactly one state`);
  return names[0];
}
function table(headings, rows) {
  return [headings, headings.map(() => "---"), ...rows].map(row => `| ${row.join(" | ")} |`).join("\n");
}

function validateFSM(fsm, draw) {
  mapping(fsm, "fsm");
  keys(fsm, ["type", "inputSize", "outputSize", "transitions", "output", "initial", "encodingSize", "encoding", "graphics"], "fsm");
  if (fsm.type !== "moore" && fsm.type !== "mealy") fail("fsm.type must be moore or mealy");
  integer(fsm.inputSize, "fsm.inputSize", 4);
  integer(fsm.outputSize, "fsm.outputSize", 16);
  if (!Array.isArray(fsm.transitions) || !fsm.transitions.length || fsm.transitions.length > 32) fail("fsm.transitions must contain between 1 and 32 states");
  const names = fsm.transitions.map((transition, index) => {
    const name = singleKey(transition, `fsm.transitions[${index}]`);
    if (!NAME.test(name)) fail(`invalid state name ${name}`);
    const destinations = transition[name];
    if (!Array.isArray(destinations) || destinations.length !== 2 ** fsm.inputSize) fail(`${name}: expected ${2 ** fsm.inputSize} transitions in binary input order`);
    for (const destination of destinations) {
      if (fsm.type === "mealy") {
        const target = singleKey(destination, `${name} transition`);
        text(target, `${name} destination`);
        bits(destination[target], fsm.outputSize, `${name}/${target} output`);
      } else text(destination, `${name} destination`);
    }
    return name;
  });
  const states = new Set(names);
  if (states.size !== names.length) fail("fsm.transitions contains duplicate states");
  // Use the native parser, including /b280, /u and /d routing annotations.
  const transitions = fsm.transitions.map(getTransition.bind(null, fsm));
  for (const transition of transitions) for (const next of transition.nextStates) {
    if (!states.has(next)) fail(`${transition.curState}: unknown destination state ${next}`);
  }
  if (fsm.initial !== undefined && !states.has(fsm.initial)) fail(`fsm.initial: unknown state ${fsm.initial}`);
  if (fsm.type === "moore") {
    if (!Array.isArray(fsm.output) || fsm.output.length !== names.length) fail("fsm.output must contain one output vector per state");
    fsm.output.forEach((output, index) => bits(output, fsm.outputSize, `fsm.output[${index}]`));
  } else if (fsm.output !== undefined) fail("mealy outputs belong to transitions, not fsm.output");
  if (!draw || fsm.encoding !== undefined || fsm.encodingSize !== undefined) {
    integer(fsm.encodingSize, "fsm.encodingSize", 5);
    mapping(fsm.encoding, "fsm.encoding");
    const codes = new Set();
    if (Object.keys(fsm.encoding).length !== names.length || Object.keys(fsm.encoding).some(name => !states.has(name))) fail("fsm.encoding must encode exactly the declared states");
    for (const name of names) {
      bits(fsm.encoding[name], fsm.encodingSize, `fsm.encoding.${name}`);
      const code = fsm.encoding[name].join("");
      if (codes.has(code)) fail(`fsm.encoding: duplicate code ${code}`);
      codes.add(code);
    }
    if (!draw && fsm.encodingSize + fsm.inputSize > 6) fail("native synthesis supports at most 6 combined state and input bits in exercise collections");
  }
  if (fsm.graphics !== undefined) {
    mapping(fsm.graphics, "fsm.graphics");
    keys(fsm.graphics, ["graphOptions", "initialLabPos", "transLabels"], "fsm.graphics");
    for (const field of ["graphOptions", "initialLabPos"]) if (fsm.graphics[field] !== undefined) text(fsm.graphics[field], `fsm.graphics.${field}`);
    if (fsm.graphics.transLabels !== undefined) {
      mapping(fsm.graphics.transLabels, "fsm.graphics.transLabels");
      for (const [edge, label] of Object.entries(fsm.graphics.transLabels)) {
        const endpoints = edge.split("/");
        if (endpoints.length !== 2 || endpoints.some(name => !states.has(name))) fail(`fsm.graphics.transLabels: unknown edge ${edge}`);
        text(label, `fsm.graphics.transLabels.${edge}`);
      }
    }
  }
  return { names, transitions };
}

function generateModel(raw) {
  mapping(raw, "generate");
  if (raw.kind === "prose") {
    keys(raw, ["kind", "request"], "generate");
    mapping(raw.request, "request");
    keys(raw.request, ["startSignal", "completionCondition"], "request");
    if (typeof raw.request.startSignal !== "string" || !NAME.test(raw.request.startSignal)) fail("request.startSignal must be a signal identifier");
    text(raw.request.completionCondition, "request.completionCondition");
    return { prose: true, values: Object.assign({}, raw.request) };
  }
  keys(raw, ["fsm", "draw", "flipFlop", "randomSeed"], "generate");
  if (raw.draw !== undefined && typeof raw.draw !== "boolean") fail("draw must be boolean");
  if (raw.flipFlop !== undefined && !Object.prototype.hasOwnProperty.call(FLIP_FLOPS, raw.flipFlop)) fail("flipFlop must be D, SR, T or JK");
  if (raw.draw && raw.flipFlop !== undefined) fail("draw-only models cannot request flip-flop excitation artifacts");
  const randomSeed = raw.randomSeed === undefined ? 1 : raw.randomSeed;
  if (!Number.isSafeInteger(randomSeed)) fail("randomSeed must be a safe integer");
  const fsm = raw.fsm;
  const { names, transitions } = validateFSM(fsm, raw.draw === true);
  const options = { draw: raw.draw === true, randomSeed };
  const artifacts = createFSMArtifacts(fsm, options);
  const values = { type: fsm.type, inputSize: fsm.inputSize, outputSize: fsm.outputSize, stateCount: names.length };
  if (raw.flipFlop !== undefined) values.flipFlop = raw.flipFlop;
  const inputLabels = Array.from({ length: 2 ** fsm.inputSize }, (_, index) => index.toString(2).padStart(fsm.inputSize, "0"));
  const headings = ["Stato", ...inputLabels.map(input => `$${input}$`)];
  if (fsm.type === "moore") headings.push("Uscita");
  values.stateTableMarkdown = table(headings, transitions.map((transition, index) => {
    const row = [`$${transition.curState}$`, ...transition.nextStates.map((next, column) =>
      fsm.type === "mealy" ? `$${next}/${transition.outputs[column].join("")}$` : `$${next}$`)];
    if (fsm.type === "moore") row.push(`$${fsm.output[index].join("")}$`);
    return row;
  }));
  if (fsm.encoding !== undefined) {
    values.encodingSize = fsm.encodingSize;
    values.encodingLatex = Object.entries(fsm.encoding).map(([name, code]) => `${name}=${code.join("")}`).join(",\\; ");
    values.encodingTableMarkdown = table(["Stato", ...Array.from({ length: fsm.encodingSize }, (_, index) => `$Q_${index}$`)],
      Object.entries(fsm.encoding).map(([name, code]) => [`$${name}$`, ...code]));
  }
  const suffixes = { diagramAssets: "diagram" };
  if (!options.draw) {
    suffixes.stateEncodingAssets = "state-encoding";
    for (const [field, suffix] of [["transitionTable", "transition-table"], ["outputTable", "output-table"],
      ...Object.keys(FLIP_FLOPS).map(type => [`${type.toLowerCase()}ExcitationTable`, `${type.toLowerCase()}-excitation-table`])]) {
      suffixes[`${field}Assets`] = suffix;
      suffixes[`${field}BlankAssets`] = `${suffix}-blank`;
      suffixes[`${field}ShortBlankAssets`] = `${suffix}-short-blank`;
    }
    for (const pin of ["D", "S", "R", "T", "J", "K", "O"]) {
      const count = pin === "O" ? fsm.outputSize : fsm.encodingSize;
      for (let bit = 0; bit < count; bit++) {
        suffixes[`${pin.toLowerCase()}${bit}ExpressionAssets`] = `${pin.toLowerCase()}-${bit}-expression`;
        suffixes[`${pin.toLowerCase()}${bit}KarnaughAssets`] = `${pin.toLowerCase()}-${bit}-karnaugh-map`;
      }
    }
    if (raw.flipFlop !== undefined) {
      for (const variant of ["", "Blank", "ShortBlank"]) suffixes[`excitationTable${variant}Assets`] = suffixes[`${raw.flipFlop.toLowerCase()}ExcitationTable${variant}Assets`];
      let index = 0;
      for (let bit = 0; bit < fsm.encodingSize; bit++) for (const pin of FLIP_FLOPS[raw.flipFlop]) {
        for (const kind of ["Expression", "Karnaugh"]) suffixes[`excitation${index}${kind}Assets`] = suffixes[`${pin.toLowerCase()}${bit}${kind}Assets`];
        index++;
      }
    }
  }
  return { fsm, options, artifacts, values, suffixes };
}

module.exports = { generateModel };
