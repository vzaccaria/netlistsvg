"use strict";

const { generateModel: booleanModel } = require("../vz-logic/model");
const MAX_SIGNALS = 128;
const MAX_TIME = 1000000;
const PRIMITIVES = Object.freeze({
  dffms: { ports: ["D", "clk", "rst", "Q"], reset: 0 },
  dffmsn: { ports: ["D", "clk", "rst", "Q"], reset: 1 },
  rsffms: { ports: ["r", "s", "clk", "rst", "Q"], reset: 0 },
  tffms: { ports: ["t", "clk", "rst", "Q"], reset: 0 }
});
// Verilog-2005 keywords: identifiers are never interpolated as executable source.
const RESERVED = new Set(("always and assign automatic begin buf bufif0 bufif1 case casex casez cell cmos config deassign default defparam design disable edge else end endcase endconfig endfunction endgenerate endmodule endprimitive endspecify endtable endtask event for force forever fork function generate genvar highz0 highz1 if ifnone incdir include initial inout input instance integer join large liblist library localparam macromodule medium module nand negedge nmos nor noshowcancelled not notif0 notif1 or output parameter pmos posedge primitive pull0 pull1 pulldown pullup pulsestyle_onevent pulsestyle_ondetect rcmos real realtime reg release repeat rnmos rpmos rtran rtranif0 rtranif1 scalared showcancelled signed small specify specparam strong0 strong1 supply0 supply1 table task time tran tranif0 tranif1 tri tri0 tri1 triand trior trireg unsigned use vectored wait wand weak0 weak1 while wire wor xnor xor").split(" "));
function fail(message) { throw new Error(message); }
function mapping(value, label, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be a mapping`);
  if (allowed) for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label}: unknown option ${key}`);
  return value;
}
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${label} must be an integer from ${min} to ${max}`);
  return value;
}
function identifier(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value) || value.length > 128 || RESERVED.has(value)) fail(`${label}: invalid Verilog identifier ${value}`);
  return value;
}
function list(value, label, max = MAX_SIGNALS) {
  if (!Array.isArray(value) || value.length > max) fail(`${label} must be an array with at most ${max} entries`);
  return value;
}
function names(value, label) {
  const result = list(value, label).map(name => identifier(name, label));
  if (new Set(result).size !== result.length) fail(`${label}: duplicate identifier`);
  return result;
}
function bit(value, label) {
  if (![0, 1, "x", "z"].includes(value)) fail(`${label} must be 0, 1, x or z`);
  return `1'b${value}`;
}
function primitive(type, ports) {
  const q = ports[ports.length - 1], clk = ports[ports.length - 3], rst = ports[ports.length - 2];
  let update = `${q} <= ${ports[0]};`;
  if (type === "rsffms") update = `if (${ports[1]} | ${ports[0]})\n      ${q} <= !${ports[0]} & ${ports[1]};\n    else\n      ${q} <= ${q};`;
  if (type === "tffms") update = `if (${ports[0]})\n      ${q} <= !${q};`;
  // These are deliberately independent processes, NOT reset-priority flip-flops.
  return `module ${type}(input ${ports.slice(0, -1).join(", ")}, output ${q});\n  reg ${q};\n  always @( ${rst} )\n    if (${rst} == 1'b1) ${q} <= ${PRIMITIVES[type].reset};\n  always @(negedge ${clk})\n    ${update}\nendmodule\n`;
}

function generateModel(raw) {
  mapping(raw, "generate");
  if (raw.kind === "prose") {
    const circuitFigure = raw.circuitFigure;
    const booleanOptions = Object.assign({}, raw);
    delete booleanOptions.circuitFigure;
    const model = booleanModel(booleanOptions);
    if (circuitFigure !== undefined && (typeof circuitFigure !== "string" || !circuitFigure.trim())) fail("circuitFigure must be a non-empty relative path");
    if (model.netlists.length) fail("prose cannot generate netlists");
    return { values: model.values, prose: true };
  }
  mapping(raw, "generate", ["kind", "circuit", "testbench", "wave", "netlist"]);
  if (raw.kind !== undefined && raw.kind !== "sequential") fail("kind must be sequential or prose");
  const circuit = mapping(raw.circuit, "circuit", ["inputs", "outputs", "wires", "equations", "flops", "primitivePorts", "buses", "latexVariants"]);
  const inputs = names(circuit.inputs, "circuit.inputs"), outputs = names(circuit.outputs, "circuit.outputs");
  const wires = names(circuit.wires || [], "circuit.wires");
  if (!inputs.length || !outputs.length) fail("circuit inputs and outputs must be non-empty");
  const declared = names([...inputs, ...outputs, ...wires], "circuit signals");
  const declarations = new Set(declared);
  const equations = mapping(circuit.equations, "circuit.equations");
  const equationNames = names(Object.keys(equations), "equations");
  if (!equationNames.length) fail("equations must be non-empty");
  const expressionSources = Object.create(null), muxes = Object.create(null);
  for (const [name, equation] of Object.entries(equations)) {
    if (!declarations.has(name) || inputs.includes(name)) fail(`equation ${name} must drive a declared wire or output`);
    if (typeof equation === "string") expressionSources[name] = equation;
    else {
      mapping(equation, `equation ${name}`, ["mux"]);
      const mux = mapping(equation.mux, `equation ${name}.mux`, ["select", "whenTrue", "whenFalse"]);
      for (const field of ["select", "whenTrue", "whenFalse"]) if (typeof mux[field] !== "string" || mux[field].length > 1024) fail(`mux.${field} must be a bounded expression string`);
      // The Boolean AST supplies the mathematical formula, but RTL retains ?: for X/Z merge semantics.
      expressionSources[name] = `(${mux.select}) & (${mux.whenTrue}) | ~(${mux.select}) & (${mux.whenFalse})`;
      muxes[name] = mux;
    }
  }
  const variants = mapping(circuit.latexVariants || {}, "circuit.latexVariants");
  for (const [variant, labels] of Object.entries(variants)) {
    mapping(labels, `latexVariants.${variant}`);
    for (const name of Object.keys(labels)) if (!declarations.has(name)) fail(`LaTeX variant: unknown variable ${name}`);
  }
  const values = Object.create(null), assignments = [];
  for (const name of equationNames) {
    // Depend only on each scalar expression's referenced signals, not all ports/wires.
    // This is name collection, not a second parser: syntax and truth remain Boolean AST work.
    const tokens = new Set(expressionSources[name].match(/[A-Za-z_][A-Za-z0-9_]*/g) || []);
    const variables = declared.filter(variable => tokens.has(variable));
    const latexVariants = Object.fromEntries(Object.entries(variants).map(([variant, labels]) =>
      [variant, Object.fromEntries(Object.entries(labels).filter(([variable]) => variables.includes(variable)))]));
    const compiled = booleanModel({ variables, expressions: { [name]: expressionSources[name] }, latexVariants });
    for (const field of [`${name}Latex`, `${name}FunctionalLatex`,
      ...Object.keys(variants).map(variant => `${name}${variant[0].toUpperCase() + variant.slice(1)}Latex`)]) {
      if (Object.prototype.hasOwnProperty.call(values, field)) fail(`generated value collision ${field}`);
      values[field] = compiled.values[field];
    }
    let expression = compiled.compiledExpressions[name].verilog;
    if (muxes[name]) {
      const parts = booleanModel({ variables, expressions: muxes[name] }).compiledExpressions;
      expression = `(${parts.select.verilog} ? ${parts.whenTrue.verilog} : ${parts.whenFalse.verilog})`;
    }
    assignments.push(`  assign ${name} = ${expression};`);
  }
  const customPorts = mapping(circuit.primitivePorts || {}, "primitivePorts", Object.keys(PRIMITIVES));
  const formalPorts = Object.create(null);
  for (const type of Object.keys(PRIMITIVES)) {
    formalPorts[type] = customPorts[type] === undefined ? PRIMITIVES[type].ports : names(customPorts[type], `primitivePorts.${type}`);
    if (formalPorts[type].length !== PRIMITIVES[type].ports.length) fail(`primitivePorts.${type}: wrong arity`);
  }
  const driven = new Set(equationNames), instanceNames = new Set(), types = new Set();
  const flops = list(circuit.flops, "circuit.flops", 32);
  if (!flops.length) fail("circuit.flops must be non-empty");
  const instances = flops.map((flop, index) => {
    mapping(flop, `flops[${index}]`, ["type", "name", "ports"]);
    if (!Object.prototype.hasOwnProperty.call(PRIMITIVES, flop.type)) fail(`unknown primitive ${flop.type}`);
    identifier(flop.name, "flop.name");
    if (instanceNames.has(flop.name) || declarations.has(flop.name)) fail(`duplicate instance name ${flop.name}`);
    instanceNames.add(flop.name);
    const ports = list(flop.ports, "flop.ports");
    if (ports.length !== formalPorts[flop.type].length || ports.some(port => !declarations.has(port))) fail(`flop ${flop.name}: ports must reference declared scalar signals with matching arity`);
    const output = ports[ports.length - 1];
    if (inputs.includes(output) || driven.has(output)) fail(`multiple drivers or input driver for ${output}`);
    driven.add(output);
    if (Object.prototype.hasOwnProperty.call(values, `${output}Reset`)) fail(`generated value collision ${output}Reset`);
    values[`${output}Reset`] = PRIMITIVES[flop.type].reset;
    types.add(flop.type);
    return `  ${flop.type} ${flop.name}(${ports.join(", ")});`;
  });
  for (const output of outputs) if (!driven.has(output)) fail(`undriven output ${output}`);
  const buses = mapping(circuit.buses || {}, "circuit.buses");
  names(Object.keys(buses), "bus names");
  const busLines = [];
  for (const [name, bits] of Object.entries(buses)) {
    if (declarations.has(name) || instanceNames.has(name)) fail(`bus ${name} collides with a circuit name`);
    list(bits, `bus ${name}`, 32);
    if (bits.length < 2 || bits.some(signal => !declarations.has(signal))) fail(`bus ${name} needs 2..32 declared scalar signals, MSB first`);
    busLines.push(`  wire [${bits.length - 1}:0] ${name};`, `  assign ${name} = {${bits.join(", ")}};`);
  }
  const rtl = [...types].map(type => primitive(type, formalPorts[type])).join("\n") +
    `\nmodule test0(${[...inputs.map(name => `input ${name}`), ...outputs.map(name => `output ${name}`)].join(", ")});\n` +
    [...wires.map(name => `  wire ${name};`), ...instances, ...assignments, ...busLines].join("\n") + "\nendmodule\n";

  const tb = mapping(raw.testbench, "testbench", ["regs", "wires", "ports", "clock", "events"]);
  const regs = mapping(tb.regs, "testbench.regs"), regNames = names(Object.keys(regs), "testbench.regs");
  const tbWires = names(tb.wires || [], "testbench.wires"), tbSignals = names([...regNames, ...tbWires], "testbench signals");
  if (tbSignals.includes("dut") || tbSignals.includes("test")) fail("testbench signal collides with hierarchy name");
  const ports = list(tb.ports, "testbench.ports");
  if (ports.length !== inputs.length + outputs.length) fail("testbench.ports has wrong arity");
  ports.forEach((port, index) => {
    if (!(index < inputs.length ? regNames : tbWires).includes(port)) fail(`testbench port ${port} must connect ${index < inputs.length ? "a reg" : "a wire"}`);
  });
  const clock = mapping(tb.clock, "testbench.clock", ["signal", "halfPeriod"]);
  if (!regNames.includes(clock.signal)) fail("clock.signal must name a testbench reg");
  integer(clock.halfPeriod, 1, MAX_TIME, "clock.halfPeriod");
  const events = list(tb.events, "testbench.events", 4096);
  if (!events.length) fail("testbench.events must end with finish");
  let totalTime = 0;
  const eventLines = events.map((event, index) => {
    mapping(event, `events[${index}]`, ["delay", "set", "finish"]);
    totalTime += integer(event.delay, 0, MAX_TIME, "event.delay");
    if (totalTime > MAX_TIME) fail(`simulation exceeds ${MAX_TIME} time units`);
    if (event.finish !== undefined) {
      if (event.finish !== true || event.set !== undefined || index !== events.length - 1) fail("finish must be true, exclusive, and the final event");
      return `    #${event.delay} $finish;`;
    }
    const set = mapping(event.set, "event.set");
    if (!Object.keys(set).length) fail("event.set must not be empty");
    const changes = Object.entries(set).map(([signal, value]) => {
      if (!regNames.includes(signal) || signal === clock.signal) fail(`event cannot drive ${signal}`);
      return `${signal} = ${bit(value, `event ${signal}`)};`;
    });
    return `    #${event.delay} ${changes.join(" ")}`;
  });
  if (events[events.length - 1].finish !== true || totalTime < 1) fail("testbench.events must finish after positive bounded time");
  const testbench = '`include "test.v"\n\nmodule test;\n' +
    regNames.map(name => `  reg ${name} = ${bit(regs[name], `reg ${name}`)};`).join("\n") + "\n" +
    tbWires.map(name => `  wire ${name};`).join("\n") +
    `\n  test0 dut(${ports.join(", ")});\n  always #${clock.halfPeriod} ${clock.signal} = !${clock.signal};\n` +
    '  initial begin\n    $dumpfile("./test.vcd");\n    $dumpvars(0, test);\n' + eventLines.join("\n") + "\n  end\nendmodule\n";

  // Include primitive aliases too: sootty resolves basenames, not hierarchical paths.
  const hierarchy = [...tbSignals.map(name => `test.${name}`), ...declared.map(name => `test.dut.${name}`),
    ...Object.keys(buses).map(name => `test.dut.${name}`),
    ...flops.flatMap(flop => formalPorts[flop.type].map(port => `test.dut.${flop.name}.${port}`))];
  const wave = mapping(raw.wave, "wave", ["renderer", "signals", "end", "whitelist", "radix"]);
  const renderer = wave.renderer === undefined ? "wave" : wave.renderer;
  if (!["wave", "sootty"].includes(renderer)) fail("wave.renderer must be wave or sootty");
  integer(wave.end, 1, MAX_TIME, "wave.end");
  const whitelist = names(wave.whitelist, "wave.whitelist");
  if (!whitelist.length) fail("wave.whitelist must be non-empty");
  let signals;
  if (renderer === "wave") {
    if (wave.radix !== undefined) fail("wave.radix requires sootty");
    if (wave.signals !== undefined) {
      signals = list(wave.signals, "wave.signals");
      if (!signals.length || new Set(signals).size !== signals.length || signals.some(signal => !hierarchy.includes(signal))) fail("wave.signals must name distinct existing hierarchical signals");
      if (signals.some(signal => Object.keys(buses).some(bus => signal === `test.dut.${bus}`))) fail("packed bus rendering requires sootty");
    } else if (Object.keys(buses).length) fail("wave with buses requires an explicit scalar signals selection");
  } else {
    signals = names(wave.signals, "wave.signals");
    if (!signals.length) fail("sootty requires explicit basename signals");
    const counts = new Map();
    for (const signal of hierarchy) {
      const name = signal.split(".").pop();
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    for (const signal of signals) if (counts.get(signal) !== 1) fail(`sootty signal ${signal} is missing or has an ambiguous display basename`);
    if (whitelist.some(signal => !signals.includes(signal))) fail("sootty whitelist must be a subset of selected basenames (case-sensitive)");
    if (wave.radix !== undefined) integer(wave.radix, 2, 36, "wave.radix");
  }
  const netlist = mapping(raw.netlist || {}, "netlist", ["mode", "ffIndices", "skin"]);
  if (netlist.mode !== undefined && !["simple", "aig", "techmap"].includes(netlist.mode)) fail("netlist.mode must be simple, aig or techmap");
  if (netlist.ffIndices !== undefined) {
    list(netlist.ffIndices, "netlist.ffIndices", 32).forEach(value => integer(value, 0, 1000000, "ff index"));
    if (!netlist.ffIndices.length) fail("ffIndices must be non-empty");
  }
  if (netlist.skin !== undefined && (typeof netlist.skin !== "string" || !netlist.skin.trim() || netlist.skin.length > 4096 || ["\0", "\r", "\n", "{", "}"].some(char => netlist.skin.includes(char)))) fail("netlist.skin must be a bounded path without control characters or template braces");
  return { values, rtl, testbench, wave: { renderer, signals, end: wave.end, whitelist, radix: wave.radix }, netlist, hierarchy };
}

module.exports = { generateModel };
