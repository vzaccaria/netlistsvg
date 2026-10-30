"use strict";

const MAX_VARIABLES = 10;
const MAX_EXPRESSIONS = 128;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ASSET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const VERILOG_RESERVED = new Set(("always and assign automatic begin buf bufif0 bufif1 case casex casez cell cmos config deassign default defparam design disable edge else end endcase endconfig endfunction endgenerate endmodule endprimitive endspecify endtable endtask event for force forever fork function generate genvar highz0 highz1 if ifnone incdir include initial inout input instance integer join large liblist library localparam macromodule medium module nand negedge nmos nor noshowcancelled not notif0 notif1 or output parameter pmos posedge primitive pull0 pull1 pulldown pullup pulsestyle_onevent pulsestyle_ondetect rcmos real realtime reg release repeat rnmos rpmos rtran rtranif0 rtranif1 scalared showcancelled signed small specify specparam strong0 strong1 supply0 supply1 table task time tran tranif0 tranif1 tri tri0 tri1 triand trior trireg unsigned use vectored wait wand weak0 weak1 while wire wor xnor xor").split(" "));
const PRECEDENCE = { "|": 1, "^": 2, "&": 3 };
const OP_NAMES = { "~": "not", "&": "and", "|": "or", "^": "xor" };

function fail(message) { throw new Error(message); }
function mapping(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be a mapping`);
  return value;
}
function keys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label}: unknown option ${key}`);
}
function text(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}
function list(value, label, maximum = MAX_EXPRESSIONS) {
  if (!Array.isArray(value) || value.length > maximum) fail(`${label} must be an array with at most ${maximum} entries`);
  return value;
}
function names(value, label) {
  const result = list(value, label, MAX_VARIABLES);
  const seen = new Set();
  for (const name of result) {
    if (typeof name !== "string" || !IDENTIFIER.test(name)) fail(`${label}: invalid identifier ${name}`);
    if (seen.has(name)) fail(`${label}: duplicate identifier ${name}`);
    seen.add(name);
  }
  return result.slice();
}

// Deliberately scalar: the grammar has no calls, indexing, implicit products or JS evaluation.
function parseExpression(source, variables) {
  text(source, "expression");
  if (source.length > 4096) fail("expression exceeds 4096 characters");
  let position = 0;
  let nodeCount = 0;
  const allowed = new Set(variables);
  function whitespace() { while (/\s/.test(source[position] || "") && position < source.length) position++; }
  function node(value) {
    if (++nodeCount > 1024) fail("expression exceeds 1024 nodes");
    return value;
  }
  function expression(minimum, depth) {
    if (depth > 64) fail("expression nesting exceeds 64 levels");
    whitespace();
    let left;
    const token = source[position];
    if (token === "~") {
      position++;
      left = node({ op: "~", child: expression(4, depth + 1) });
    } else if (token === "(") {
      position++;
      left = expression(1, depth + 1);
      whitespace();
      if (source[position++] !== ")") fail(`expression: expected ')' at position ${position}`);
    } else {
      const match = source.slice(position).match(/^(?:[A-Za-z_][A-Za-z0-9_]*|[01])/);
      if (!match) fail(`expression: expected identifier, constant or '(' at position ${position}`);
      position += match[0].length;
      if (match[0] === "0" || match[0] === "1") left = node({ constant: Number(match[0]) });
      else {
        if (!allowed.has(match[0])) fail(`expression: unknown variable ${match[0]}`);
        left = node({ variable: match[0] });
      }
    }
    whitespace();
    while (PRECEDENCE[source[position]] >= minimum) {
      const op = source[position++];
      left = node({ op, left, right: expression(PRECEDENCE[op] + 1, depth + 1) });
      whitespace();
    }
    return left;
  }
  const result = expression(1, 0);
  if (position !== source.length) fail(`expression: unexpected token at position ${position}`);
  return result;
}

function evaluate(node, assignment) {
  if (node.variable !== undefined) return assignment[node.variable];
  if (node.constant !== undefined) return node.constant;
  if (node.op === "~") return 1 - evaluate(node.child, assignment);
  const a = evaluate(node.left, assignment), b = evaluate(node.right, assignment);
  if (node.op === "&") return a & b;
  if (node.op === "|") return a | b;
  return a ^ b;
}
function variableLatex(name) {
  const underscore = name.indexOf("_");
  return underscore <= 0 || underscore === name.length - 1 ? name.replace(/_/g, "\\_") : `${name.slice(0, underscore)}_{${name.slice(underscore + 1).replace(/_/g, "\\_")}}`;
}
function latex(node, parent = 0, labels = {}) {
  if (node.variable !== undefined) return Object.prototype.hasOwnProperty.call(labels, node.variable) ? labels[node.variable] : variableLatex(node.variable);
  if (node.constant !== undefined) return String(node.constant);
  if (node.op === "~") return `\\overline{${latex(node.child, 0, labels)}}`;
  const precedence = PRECEDENCE[node.op];
  const symbol = { "&": " \\cdot ", "|": " + ", "^": " \\oplus " }[node.op];
  const value = latex(node.left, precedence, labels) + symbol + latex(node.right, precedence, labels);
  return precedence < parent ? `\\left(${value}\\right)` : value;
}
function functionalLatex(node) {
  if (!node.op) return latex(node);
  const operands = node.child ? [node.child] : [node.left, node.right];
  return `\\operatorname{${OP_NAMES[node.op].toUpperCase()}}\\left(${operands.map(functionalLatex).join(", ")}\\right)`;
}
function verilog(node) {
  if (node.variable !== undefined) return node.variable;
  if (node.constant !== undefined) return `1'b${node.constant}`;
  if (node.op === "~") return `~(${verilog(node.child)})`;
  return `(${verilog(node.left)} ${node.op} ${verilog(node.right)})`;
}
function visit(node, action) {
  action(node);
  if (node.child) visit(node.child, action);
  if (node.left) { visit(node.left, action); visit(node.right, action); }
}
function cost(node) {
  let literalCount = 0, gateCount = 0, inputCount = 0, binaryGateCount = 0;
  visit(node, current => { if (current.variable !== undefined) literalCount++; });
  function gates(current) {
    if (current.op === "~") { gates(current.child); return; }
    if (!current.op) return;
    if (current.op === "^") fail("AND/OR cost model does not define XOR cost");
    const children = [];
    function flatten(child) {
      if (child.op === current.op) { flatten(child.left); flatten(child.right); }
      else children.push(child);
    }
    flatten(current);
    gateCount++;
    inputCount += children.length;
    binaryGateCount += children.length - 1;
    children.forEach(gates);
  }
  gates(node);
  return { gateCount, literalCount, inputCount, binaryGateCount, binaryInputCount: binaryGateCount * 2 };
}
function table(headers, rows) {
  return [headers, headers.map(() => "---"), ...rows].map(row => `| ${row.join(" | ")} |`).join("\n");
}
function multipleAst(variables, spec) {
  // Canonical minterms are a direct encoding of the predicate, not a minimizer.
  function combine(op, nodes, identity) {
    if (!nodes.length) return { constant: identity };
    function balanced(start, end) {
      if (end - start === 1) return nodes[start];
      const middle = start + Math.floor((end - start) / 2);
      return { op, left: balanced(start, middle), right: balanced(middle, end) };
    }
    return balanced(0, nodes.length);
  }
  const terms = [];
  for (let index = 0; index < 2 ** variables.length; index++) {
    if (index % spec.divisor !== 0 || (!spec.includeZero && index === 0)) continue;
    terms.push(combine("&", variables.map((variable, bit) => {
      const node = { variable };
      return (index >> (variables.length - bit - 1)) & 1 ? node : { op: "~", child: node };
    }), 1));
  }
  return combine("|", terms, 0);
}

function generateModel(raw) {
  const options = mapping(raw, "generate");
  keys(options, ["kind", "variables", "expressions", "columns", "steps", "checks", "costs", "parameters", "specification", "netlists", "restrictions", "variableLabels", "latexVariants"], "generate");
  const kind = options.kind === undefined ? "boolean" : options.kind;
  if (kind !== "boolean" && kind !== "prose") fail("kind must be boolean or prose");
  const variables = names(options.variables === undefined && kind === "prose" ? [] : options.variables, "variables");
  let spec;
  if (options.specification !== undefined) {
    spec = mapping(options.specification, "specification");
    keys(spec, ["kind", "divisor", "includeZero", "expression"], "specification");
    if (spec.kind !== "multiple") fail("specification.kind must be multiple");
    if (!Number.isSafeInteger(spec.divisor) || spec.divisor < 1) fail("specification.divisor must be a positive safe integer");
    if (typeof spec.includeZero !== "boolean") fail("specification.includeZero must be boolean");
    if (typeof spec.expression !== "string" || !IDENTIFIER.test(spec.expression)) fail("specification.expression must be an expression name");
  }
  const expressions = mapping(options.expressions === undefined && (kind === "prose" || spec) ? {} : options.expressions, "expressions");
  const expressionNames = Object.keys(expressions);
  if (spec && Object.prototype.hasOwnProperty.call(expressions, spec.expression)) fail(`specification.expression ${spec.expression} conflicts with a manually supplied expression`);
  if (expressionNames.length + (spec ? 1 : 0) > MAX_EXPRESSIONS || (!expressionNames.length && kind !== "prose" && !spec)) fail(`expressions must contain between 1 and ${MAX_EXPRESSIONS} expressions`);
  const asts = Object.create(null);
  const values = Object.create(null);
  function value(name, result) {
    if (Object.prototype.hasOwnProperty.call(values, name) || ["id", "tag", "asset_name", "assets", "source", "intro", "commentary", "exercise"].includes(name)) fail(`generated value collision ${name}`);
    values[name] = result;
  }
  value("variablesLatex", variables.map(variableLatex).join(", "));
  value("variableCount", variables.length);
  value("firstVariableLatex", variables.length ? variableLatex(variables[0]) : "");
  value("lastVariableLatex", variables.length ? variableLatex(variables[variables.length - 1]) : "");
  for (const name of expressionNames) {
    if (!IDENTIFIER.test(name)) fail(`invalid expression name ${name}`);
    asts[name] = parseExpression(expressions[name], variables);
  }
  if (spec) {
    asts[spec.expression] = multipleAst(variables, spec);
    expressionNames.push(spec.expression);
  }
  for (const name of expressionNames) {
    value(`${name}Latex`, latex(asts[name]));
    value(`${name}FunctionalLatex`, functionalLatex(asts[name]));
  }
  function named(name, label) {
    if (typeof name !== "string" || !Object.prototype.hasOwnProperty.call(asts, name)) fail(`${label}: unknown expression ${name}`);
    return asts[name];
  }
  const variants = mapping(options.latexVariants === undefined ? {} : options.latexVariants, "latexVariants");
  if (Object.keys(variants).length > 16) fail("latexVariants supports at most 16 variants");
  for (const [variant, rawLabels] of Object.entries(variants)) {
    if (!IDENTIFIER.test(variant)) fail(`invalid LaTeX variant name ${variant}`);
    const labels = mapping(rawLabels, `latexVariants.${variant}`);
    for (const [name, label] of Object.entries(labels)) {
      if (!variables.includes(name)) fail(`LaTeX variant: unknown variable ${name}`);
      if (text(label, `latexVariants.${variant}.${name}`).length > 1024) fail("LaTeX variant label exceeds 1024 characters");
    }
    for (const name of expressionNames) {
      value(`${name}${variant[0].toUpperCase() + variant.slice(1)}Latex`, latex(asts[name], 0, labels));
    }
  }
  const parameters = mapping(options.parameters === undefined ? {} : options.parameters, "parameters");
  for (const [name, parameter] of Object.entries(parameters)) {
    if (!IDENTIFIER.test(name)) fail(`invalid parameter name ${name}`);
    if (!["string", "number", "boolean"].includes(typeof parameter) || (typeof parameter === "number" && !Number.isFinite(parameter))) fail(`parameter ${name} must be a finite scalar`);
    value(name, parameter);
  }
  if (kind === "prose" && !expressionNames.length && !Object.keys(parameters).length) fail("prose requires meaningful parameters or expressions");
  const rows = Array.from({ length: 2 ** variables.length }, (_, index) => {
    const inputs = variables.map((_, bit) => (index >> (variables.length - bit - 1)) & 1);
    const assignment = Object.fromEntries(variables.map((name, bit) => [name, inputs[bit]]));
    return { inputs, assignment, outputs: Object.fromEntries(expressionNames.map(name => [name, evaluate(asts[name], assignment)])) };
  });
  function equivalent(left, right, label) {
    named(left, label); named(right, label);
    const mismatch = rows.find(row => row.outputs[left] !== row.outputs[right]);
    if (mismatch) fail(`${label}: ${left} and ${right} differ for ${JSON.stringify(mismatch.assignment)}`);
  }
  const steps = options.steps === undefined ? [] : list(options.steps, "steps");
  steps.forEach((step, index) => {
    mapping(step, `steps[${index}]`);
    keys(step, ["expression", "reason"], `steps[${index}]`);
    named(step.expression, `steps[${index}]`);
    if (index || step.reason !== undefined) text(step.reason, `steps[${index}].reason`);
    if (index) equivalent(steps[0].expression, step.expression, `steps[${index}]`);
  });
  const proof = steps.map((step, index) => {
    const reason = step.reason === undefined ? "" : ` && \\text{${step.reason.replace(/[\\{}$%&#_^~]/g, character => `\\${character}`)}}`;
    return `${index ? "&= " : "& "}${latex(asts[step.expression])}${reason}`;
  }).join(" \\\\\n");
  value("stepsLatex", steps.length ? `\\begin{aligned}\n${proof}\n\\end{aligned}` : "");
  for (const [index, check] of (options.checks === undefined ? [] : list(options.checks, "checks")).entries()) {
    if (!Array.isArray(check) || check.length !== 2) fail(`checks[${index}] must be a pair of expression names`);
    equivalent(check[0], check[1], `checks[${index}]`);
  }
  for (const [index, restriction] of (options.restrictions === undefined ? [] : list(options.restrictions, "restrictions")).entries()) {
    mapping(restriction, `restrictions[${index}]`);
    keys(restriction, ["expression", "allowed"], `restrictions[${index}]`);
    const allowed = list(restriction.allowed, "restriction.allowed", 4);
    if (allowed.some(op => !Object.values(OP_NAMES).includes(op)) || new Set(allowed).size !== allowed.length) fail("restriction.allowed must contain unique not/and/or/xor operators");
    visit(named(restriction.expression, "restriction"), node => {
      if (node.op && !allowed.includes(OP_NAMES[node.op])) fail(`restriction: ${restriction.expression} uses forbidden ${OP_NAMES[node.op]}`);
    });
    const gates = allowed.map(op => `\\text{${op.toUpperCase()}}`);
    value(`${restriction.expression}AllowedGatesLatex`, gates.join(", "));
    value(`${restriction.expression}FirstAllowedGateLatex`, gates[0] || "");
    value(`${restriction.expression}LastAllowedGateLatex`, gates[gates.length - 1] || "");
  }
  if (spec) {
    value("divisor", spec.divisor);
    value("includeZero", spec.includeZero);
  }
  const columns = options.columns === undefined ? expressionNames.map(name => ({ label: `$${name}$`, expression: name })) : list(options.columns, "columns");
  const parsedColumns = columns.map((column, index) => {
    mapping(column, `columns[${index}]`);
    keys(column, ["label", "expression", "gray"], `columns[${index}]`);
    const label = text(column.label, `columns[${index}].label`);
    if (/[|\r\n]/.test(label)) fail("column labels must be single-line Markdown without pipes");
    if (column.gray !== undefined && typeof column.gray !== "boolean") fail("column.gray must be boolean");
    const ast = Object.prototype.hasOwnProperty.call(asts, column.expression) ? asts[column.expression] : parseExpression(column.expression, variables);
    return { label, ast, gray: column.gray === true };
  });
  const variableLabels = options.variableLabels === undefined ? variables.map(name => `$${variableLatex(name)}$`) : list(options.variableLabels, "variableLabels", MAX_VARIABLES);
  if (variableLabels.length !== variables.length || variableLabels.some(label => typeof label !== "string" || !label.trim() || /[|\r\n]/.test(label))) fail("variableLabels must provide one single-line Markdown label without pipes for every variable");
  const headers = [...variableLabels, ...parsedColumns.map(column => column.label)];
  const tableRows = rows.map(row => [...row.inputs, ...parsedColumns.map(column => {
    const bit = evaluate(column.ast, row.assignment);
    return column.gray ? `$\\color{gray}{${bit}}$` : bit;
  })]);
  value("truthTable", table(headers, tableRows));
  value("blankTruthTable", table(headers, rows.map(row => [...row.inputs, ...parsedColumns.map(() => "")])));
  const costs = Object.create(null);
  const costNames = options.costs === undefined ? [] : list(options.costs, "costs");
  if (new Set(costNames).size !== costNames.length) fail("costs must not contain duplicates");
  for (const name of costNames) {
    costs[name] = cost(named(name, "costs"));
    for (const [field, result] of Object.entries(costs[name])) value(name + field[0].toUpperCase() + field.slice(1), result);
  }
  value("costTable", table(["criterio", ...costNames.map(name => `$${latex(asts[name])}$`)], [
    ["cardinalità", ...costNames.map(name => costs[name].gateCount)],
    ["letterali", ...costNames.map(name => costs[name].literalCount)],
    ["numero di input", ...costNames.map(name => costs[name].inputCount)]
  ]));
  const netlistIds = new Set();
  const netlists = (options.netlists === undefined ? [] : list(options.netlists, "netlists")).map((netlist, index) => {
    mapping(netlist, `netlists[${index}]`);
    keys(netlist, ["id", "mode", "outputs", "variables"], `netlists[${index}]`);
    if (typeof netlist.id !== "string" || !ASSET_ID.test(netlist.id)) fail("netlist.id must be a safe asset basename");
    if (netlistIds.has(netlist.id)) fail(`duplicate netlist id ${netlist.id}`);
    netlistIds.add(netlist.id);
    if (!["simple", "aig"].includes(netlist.mode)) fail("netlist.mode must be simple or aig");
    const ports = netlist.variables === undefined ? variables : names(netlist.variables, "netlist.variables");
    if (ports.some(port => !variables.includes(port))) fail("netlist.variables must be a subset of variables");
    const outputs = mapping(netlist.outputs, "netlist.outputs");
    if (!Object.keys(outputs).length || Object.keys(outputs).length > MAX_EXPRESSIONS) fail("netlist.outputs must be non-empty and bounded");
    for (const name of [...ports, ...Object.keys(outputs)]) {
      if (!IDENTIFIER.test(name) || VERILOG_RESERVED.has(name)) fail(`invalid Verilog port ${name}`);
    }
    const assignments = Object.entries(outputs).map(([name, expression]) => {
      if (ports.includes(name)) fail(`netlist output ${name} collides with an input`);
      const ast = named(expression, "netlist.outputs");
      visit(ast, node => { if (node.variable !== undefined && !ports.includes(node.variable)) fail(`netlist omits input ${node.variable}`); });
      return `  assign ${name} = ${verilog(ast)};`;
    });
    const declarations = [...ports.map(port => `input ${port}`), ...Object.keys(outputs).map(port => `output ${port}`)];
    return { id: netlist.id, mode: netlist.mode, variables: ports.slice(), outputs: Object.fromEntries(Object.entries(outputs)), rtl: `module test(${declarations.join(", ")});\n${assignments.join("\n")}\nendmodule\n` };
  });
  return { values, variables, rows, costs, netlists };
}

module.exports = { generateModel, MAX_VARIABLES };
