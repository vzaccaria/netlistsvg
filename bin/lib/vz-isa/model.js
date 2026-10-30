"use strict";
/* global BigInt */

const { executeNative } = require("../rv-native");
const TYPES = new Set([8, 16, 32, 64].flatMap(bits => [`int${bits}_t`, `uint${bits}_t`]));
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CASE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const MARKER = "__VZPAC_STATE__";

function mapping(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a mapping`);
  return value;
}
function text(value, label, empty = false) {
  if (typeof value !== "string" || (!empty && !value.trim())) throw new Error(`${label} must be ${empty ? "a string" : "a nonempty string"}`);
  return value;
}

function interpolateModel(raw) {
  const parameters = raw.parameters === undefined ? {} : mapping(raw.parameters, "parameters");
  const fragments = raw.fragments === undefined ? {} : mapping(raw.fragments, "fragments");
  const source = Object.create(null);
  for (const [name, value] of Object.entries(parameters)) {
    if (!["string", "number", "boolean"].includes(typeof value) || (typeof value === "number" && !Number.isSafeInteger(value))) {
      throw new Error(`parameter ${name} must be a scalar; quote exact 64-bit integers`);
    }
    source[name] = String(value);
  }
  for (const [name, value] of Object.entries(fragments)) {
    if (Object.prototype.hasOwnProperty.call(source, name)) throw new Error(`duplicate parameter/fragment ${name}`);
    source[name] = text(value, `fragment ${name}`, true);
  }
  const values = Object.create(null);
  const pending = new Set();
  function resolve(name) {
    if (Object.prototype.hasOwnProperty.call(values, name)) return values[name];
    if (!Object.prototype.hasOwnProperty.call(source, name)) throw new Error(`unknown placeholder \${${name}}`);
    if (pending.has(name)) throw new Error(`cyclic fragment ${name}`);
    pending.add(name);
    const value = expand(source[name]);
    pending.delete(name);
    values[name] = value;
    return value;
  }
  function expand(value) {
    return value.replace(/\$\{([^}]+)\}/g, (_, name) => resolve(name));
  }
  for (const name of Object.keys(source)) resolve(name);
  function deep(value) {
    if (typeof value === "string") return expand(value);
    if (Array.isArray(value)) return value.map(deep);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deep(child)]));
    return value;
  }
  return { values, expand: deep };
}

function observations(value, stdout) {
  if (value === undefined && stdout === true) return [];
  if (!Array.isArray(value) || (!value.length && stdout !== true)) throw new Error("observe must be nonempty, or stdout: true is required");
  const seen = new Set();
  return value.map(raw => {
    const item = mapping(raw, "observation");
    if (!IDENTIFIER.test(item.name) || seen.has(item.name)) throw new Error(`invalid or duplicate observed global ${item.name}`);
    seen.add(item.name);
    if (!TYPES.has(item.type)) throw new Error(`observation ${item.name} requires an explicit fixed-width integer type`);
    if (item.length !== undefined && (!Number.isSafeInteger(item.length) || item.length < 1)) throw new Error(`observation ${item.name} length must be positive`);
    return { name: item.name, type: item.type, length: item.length };
  });
}

function printState(observe) {
  return observe.map(item => {
    const signed = item.type.startsWith("int");
    const cast = signed ? "int64_t" : "uint64_t";
    const format = signed ? "PRId64" : "PRIu64";
    const access = item.length === undefined ? item.name : `${item.name}[__vzpac_index]`;
    const print = `fprintf(stderr, "%" ${format}, (${cast})${access});`;
    return `  fprintf(stderr, "${MARKER}${item.name}=");\n` + (item.length === undefined ? `  ${print}\n` :
      `  for (size_t __vzpac_index = 0; __vzpac_index < ${item.length}; ++__vzpac_index) {\n    if (__vzpac_index) fputs(", ", stderr);\n    ${print}\n  }\n`) + "  fputc('\\n', stderr);";
  }).join("\n");
}

function harness(spec, observe, reference) {
  const checks = observe.map(item => `_Static_assert(_Generic((${item.name}${item.length === undefined ? "" : "[0]"}), ${item.type}: 1, default: 0), "observation type mismatch: ${item.name}");`).join("\n");
  return `#include <stdint.h>\n#include <inttypes.h>\n#include <stdio.h>\n#include <stddef.h>\n#include <stdlib.h>\n${spec.declarations || ""}\n${spec.helpers || ""}\n${checks}\n${reference ? `static void __vzpac_run(void) {\n${spec.reference}\n}` : "extern void __vzpac_run(void);"}\nint main(void) {\n  __vzpac_run();\n  fflush(stdout);\n${printState(observe)}\n  return 0;\n}\n`;
}

function renameEntry(source, entry) {
  const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`^\\s*${escaped}:`, "m").test(source)) throw new Error(`asmSource does not define entry ${entry}`);
  const symbol = new RegExp(`(?<![A-Za-z0-9_.$])${escaped}(?![A-Za-z0-9_.$])`, "g");
  return source.split("\n").map(line => /^\s*\.(?:string|ascii|asciz)\b/.test(line) ? line : line.replace(symbol, "__vzpac_subject")).join("\n");
}

function assembly(spec) {
  const registers = ["ra", ...Array.from({ length: 12 }, (_, i) => `s${i}`)];
  const save = registers.map((reg, i) => `  sd ${reg},${i * 8}(sp)`).join("\n");
  const restore = registers.map((reg, i) => `  ld ${reg},${i * 8}(sp)`).join("\n");
  let body;
  let support = spec.asmSupport || "";
  if (spec.asmSource !== undefined) {
    const entry = spec.entry === undefined ? "main" : spec.entry;
    if (!IDENTIFIER.test(entry)) throw new Error("entry must be an assembly identifier");
    support += "\n" + renameEntry(spec.asmSource, entry);
    body = "  call __vzpac_subject";
  } else {
    body = spec.asm.split("\n").map(line => /^\s*\.(?:string|ascii|asciz)\b/.test(line) ? line :
      line.replace(/;;.*$/, comment => "#" + comment.slice(2))).join("\n")
      .replace(/^\s*f:\s*(?:#.*)?$/gm, "")
      .replace(/^(\s*)(?:ret|jr\s+ra)\s*(?:#.*)?$/gm, "$1j .Lvzpac_done");
    // Pedagogical bodies sometimes place string constants before instructions.
    // Keep their labels and bytes, but put those declarations in read-only data.
    body = body.replace(/^([ \t]*[.$A-Za-z_][\w.$]*:[ \t]*(?:#.*)?\n(?:[ \t]*\.(?:string|asciz|ascii|byte|half|word|quad|zero|align|balign)[^\n]*\n?)+)/gm, block => {
      support += `\n.section .rodata\n${block}\n`;
      return "";
    });
  }
  return `.text\n.globl __vzpac_run\n.type __vzpac_run, @function\n__vzpac_run:\n  addi sp,sp,-112\n${save}\n${spec.before || ""}\n${body}\n.text\n.Lvzpac_done:\n${spec.after || ""}\n${restore}\n  addi sp,sp,112\n  ret\n.size __vzpac_run, .-__vzpac_run\n${support}\n.section .note.GNU-stack,"",@progbits\n`;
}

function parseState(stderr, observe) {
  const state = Object.create(null);
  for (const item of observe) {
    const pattern = new RegExp(`^${MARKER}${item.name}=([^\\n]*)$`, "gm");
    const matches = [...stderr.matchAll(pattern)];
    if (matches.length !== 1) throw new Error(`native observation missing or duplicated: ${item.name}`);
    const elements = matches[0][1].split(", ");
    if (elements.length !== (item.length === undefined ? 1 : item.length)) throw new Error(`native observation has wrong length: ${item.name}`);
    const bits = BigInt(item.type.match(/\d+/)[0]);
    const signed = item.type.startsWith("int");
    const minimum = signed ? -(BigInt(1) << (bits - BigInt(1))) : BigInt(0);
    const maximum = (BigInt(1) << (signed ? bits - BigInt(1) : bits)) - BigInt(1);
    for (const element of elements) {
      if (!/^-?\d+$/.test(element) || BigInt(element) < minimum || BigInt(element) > maximum) throw new Error(`native observation is outside ${item.type}: ${item.name}=${element}`);
    }
    state[item.name] = elements.join(", ");
  }
  return state;
}

function executeCase(raw) {
  const spec = mapping(raw, "verify case");
  if (!CASE.test(spec.name || "")) throw new Error("verify case name must be a safe identifier");
  if ((spec.asm === undefined) === (spec.asmSource === undefined)) throw new Error(`${spec.name}: provide exactly one of asm or asmSource`);
  text(spec.asm === undefined ? spec.asmSource : spec.asm, `${spec.name} assembly`);
  text(spec.reference, `${spec.name} reference`);
  for (const key of ["declarations", "helpers", "before", "after", "asmSupport"]) if (spec[key] !== undefined) text(spec[key], `${spec.name}.${key}`, true);
  const observe = observations(spec.observe, spec.stdout);
  const sources = { "reference.c": harness(spec, observe, true), "harness.c": harness(spec, observe, false), "program.s": assembly(spec) };
  const [reference, actual] = executeNative(sources, [
    { sources: ["reference.c"], timeout: spec.timeout },
    { sources: ["harness.c", "program.s"], timeout: spec.timeout }
  ]);
  const expectedState = parseState(reference.stderr, observe);
  const state = parseState(actual.stderr, observe);
  if (actual.stdout !== reference.stdout || JSON.stringify(state) !== JSON.stringify(expectedState)) {
    throw new Error(`${spec.name}: native C/assembly mismatch\nC: ${JSON.stringify({ state: expectedState, stdout: reference.stdout })}\nasm: ${JSON.stringify({ state, stdout: actual.stdout })}`);
  }
  const result = observe.map(item => `${item.type} ${item.name}${item.length === undefined ? "" : `[${item.length}]`} = ${item.length === undefined ? state[item.name] : `{${state[item.name]}}`};`).join("\n");
  return { name: spec.name, state, stdout: actual.stdout, result, sources };
}

function generateModel(raw) {
  mapping(raw, "generate");
  const { values, expand } = interpolateModel(raw);
  const kind = raw.kind;
  if (kind !== "program" && kind !== "fragment") throw new Error("kind must be program or fragment");
  const stages = raw.stages === undefined ? {} : expand(mapping(raw.stages, "stages"));
  for (const [name, reason] of Object.entries(stages)) text(reason, `stage ${name} classification`);
  function output(name, value) {
    if (Object.prototype.hasOwnProperty.call(values, name)) throw new Error(`generated output collides with fragment/parameter ${name}`);
    values[name] = value;
  }
  if (kind === "fragment") {
    if (raw.verify !== undefined) throw new Error("fragment cannot claim executable verification");
    const reason = text(expand(raw.reason), "fragment reason");
    output("verification", `Fragment (not executable): ${reason}`);
    return { values, evidence: { kind, reason, stages }, cases: [] };
  }
  if (!Array.isArray(raw.verify) || !raw.verify.length) throw new Error("program requires nonempty verify cases");
  const seen = new Set();
  const cases = raw.verify.map(value => {
    const spec = expand(value);
    if (seen.has(spec.name)) throw new Error(`duplicate verify case ${spec.name}`);
    seen.add(spec.name);
    return executeCase(spec);
  });
  cases.forEach((item, index) => {
    output(`result_${item.name}`, item.result);
    output(`stdout_${item.name}`, item.stdout);
    for (const [name, value] of Object.entries(item.state)) {
      output(`value_${item.name}_${name}`, value);
      if (index === 0) output(`value_${name}`, value);
    }
  });
  output("result", cases[0].result);
  output("stdout", cases[0].stdout);
  output("verification", `Native C/assembly agreement for ${cases.length} deterministic case(s): ${cases.map(item => item.name).join(", ")}. Case evidence, not universal equivalence.${Object.entries(stages).map(([name, reason]) => `\nFragment ${name}: ${reason}`).join("")}`);
  return { values, evidence: { kind, engine: "GCC rv64 / QEMU", stages, cases: cases.map(({ name, state, stdout }) => ({ name, state, stdout })) }, cases };
}

module.exports = { generateModel, executeCase };
