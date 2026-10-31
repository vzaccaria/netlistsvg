"use strict";

const { render } = require("../../vz-rv-fcall");
const { executeCase } = require("../vz-isa/model");
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function mapping(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a mapping`);
  return value;
}
function text(value, label, empty = false) {
  if (typeof value !== "string" || (!empty && !value.trim())) throw new Error(`${label} must be ${empty ? "a string" : "a nonempty string"}`);
  return value;
}

function generateModel(raw) {
  mapping(raw, "generate");
  const layout = mapping(raw.layout, "layout");
  const fn = mapping(layout.functionData, "layout.functionData");
  if (!IDENTIFIER.test(fn.name || "")) throw new Error("layout.functionData.name must be an assembly identifier");
  for (const key of ["body", "cref", "suffix", "bodycontent", "crefcontent"]) {
    if (fn[key] !== undefined) throw new Error(`layout.functionData.${key} is not a canonical input; provide inline body/source`);
  }
  if (raw.full !== undefined) throw new Error("full assembly is generated from layout and body, not supplied as an input");
  const body = text(raw.body, "body", true);
  const source = text(raw.source, "source");
  if (!IDENTIFIER.test(raw.referenceSymbol || "")) throw new Error("referenceSymbol must identify the canonical C function");
  if (!new RegExp(`\\b${raw.referenceSymbol}\\s*\\(`).test(source)) throw new Error("referenceSymbol is not present in canonical C source");
  const stages = raw.stages === undefined ? {} : mapping(raw.stages, "stages");
  for (const [name, reason] of Object.entries(stages)) text(reason, `stage ${name}`);
  if (!Array.isArray(raw.verify) || !raw.verify.length) throw new Error("verify requires nonempty native cases");
  const seen = new Set();
  // Validate ownership before executing any case: verification cannot replace the
  // canonical subject or sneak in a second hand-maintained complete listing.
  for (const value of raw.verify) {
    const spec = mapping(value, "verify case");
    if (seen.has(spec.name)) throw new Error(`duplicate verify case ${spec.name}`);
    seen.add(spec.name);
    for (const key of ["asm", "asmSource", "entry", "referenceSource"]) {
      if (spec[key] !== undefined) throw new Error(`verify.${key} is generated from the canonical fcall inputs`);
    }
    text(spec.reference, `${spec.name}.reference`);
  }
  const rendered = render(layout, body, source);
  const cases = raw.verify.map(spec => executeCase(Object.assign({}, spec, {
    asmSource: rendered.values.full, entry: fn.name, referenceSource: source
  })));
  const values = Object.assign({}, rendered.values, { c: source });
  for (const [index, item] of cases.entries()) {
    values[`result_${item.name}`] = item.result;
    values[`stdout_${item.name}`] = item.stdout;
    for (const [name, value] of Object.entries(item.state)) {
      values[`value_${item.name}_${name}`] = value;
      if (index === 0) values[`value_${name}`] = value;
    }
  }
  values.result = cases[0].result;
  values.stdout = cases[0].stdout;
  values.verification = `Native C/assembly agreement for ${cases.length} deterministic case(s): ${cases.map(item => item.name).join(", ")}. Case evidence, not universal equivalence.${Object.entries(stages).map(([name, reason]) => `\nFragment ${name}: ${reason}`).join("")}`;
  return {
    values, cases, rendered,
    evidence: {
      kind: "program", engine: "GCC rv64 / QEMU", entry: fn.name,
      referenceSymbol: raw.referenceSymbol, stages,
      cases: cases.map(({ name, state, stdout }) => ({ name, state, stdout }))
    }
  };
}

module.exports = { generateModel };
