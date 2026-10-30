/* global BigInt */
"use strict";

const MAX_VARIABLES = 10;
const MAX_MINIMIZE_VARIABLES = 6;
const MAX_COVER_SEARCH_NODES = 1000000;
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

// Enumerate subsets of the native prime chart, not a second prime generator.
// Essentials are mandatory; suffix coverage prunes impossible branches.
function coverStatistics(primes, onSet, essentials, selectedCount) {
  const mask = indices => indices.reduce((bits, index) => bits | (BigInt(1) << BigInt(index)), BigInt(0));
  const target = mask(onSet);
  const essentialSet = new Set(essentials);
  const candidates = primes.filter(prime => !essentialSet.has(prime));
  const masks = candidates.map(prime => mask(prime.values) & target);
  const suffix = Array(candidates.length + 1).fill(BigInt(0));
  for (let i = candidates.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] | masks[i];
  let minimumTermCount = selectedCount, minimumCoverCount = 0;
  let minimumLiteralCount = Infinity, minimumLiteralCoverCount = 0, nodes = 0;
  function search(index, covered, count, literals) {
    if (++nodes > MAX_COVER_SEARCH_NODES) fail(`minimum cover enumeration exceeds ${MAX_COVER_SEARCH_NODES} nodes`);
    if (covered === target) {
      if (count < minimumTermCount) {
        minimumTermCount = count;
        minimumCoverCount = 0;
        minimumLiteralCount = Infinity;
        minimumLiteralCoverCount = 0;
      }
      if (count === minimumTermCount) {
        minimumCoverCount++;
        if (literals < minimumLiteralCount) {
          minimumLiteralCount = literals;
          minimumLiteralCoverCount = 0;
        }
        if (literals === minimumLiteralCount) minimumLiteralCoverCount++;
      }
      return;
    }
    if (index === candidates.length || count >= minimumTermCount || (covered | suffix[index]) !== target) return;
    if ((covered | masks[index]) !== covered) {
      search(index + 1, covered | masks[index], count + 1, literals + candidates[index].literalCount);
    }
    search(index + 1, covered, count, literals);
  }
  search(0, essentials.reduce((bits, prime) => bits | mask(prime.values), BigInt(0)) & target,
    essentials.length, essentials.reduce((sum, prime) => sum + prime.literalCount, 0));
  return { minimumTermCount, minimumCoverCount, minimumLiteralCount, minimumLiteralCoverCount };
}

function minimizeModel(options) {
  keys(options, ["kind", "variables", "table", "expression", "timing"], "generate");
  const variables = names(options.variables, "variables");
  if (!variables.length || variables.length > MAX_MINIMIZE_VARIABLES) fail(`minimize requires 1 to ${MAX_MINIMIZE_VARIABLES} variables`);
  if (typeof options.table !== "string" || !/^[01x]+$/.test(options.table)) fail("table must be a quoted native 01x vector");
  if (options.table.length !== 2 ** variables.length) fail(`table must contain exactly ${2 ** variables.length} entries for ${variables.length} variables`);
  const expression = options.expression === undefined ? undefined : parseExpression(options.expression, variables);
  let timing;
  if (options.timing !== undefined) {
    timing = mapping(options.timing, "timing");
    keys(timing, ["andFanIn", "andDelay", "orFanIn", "orDelay"], "timing");
    for (const name of ["andFanIn", "orFanIn"]) {
      if (!Number.isSafeInteger(timing[name]) || timing[name] < 2 || timing[name] > 64) fail(`timing.${name} must be an integer between 2 and 64`);
    }
    for (const name of ["andDelay", "orDelay"]) {
      if (typeof timing[name] !== "number" || !Number.isFinite(timing[name]) || timing[name] < 0) fail(`timing.${name} must be a non-negative finite number`);
    }
  }
  const rows = Array.from(options.table, (bit, index) => {
    const inputs = variables.map((_, position) => (index >> (variables.length - position - 1)) & 1);
    const assignment = Object.fromEntries(variables.map((name, position) => [name, inputs[position]]));
    if (expression && bit !== "x" && evaluate(expression, assignment) !== Number(bit)) fail(`expression differs from table at row ${index}: ${JSON.stringify(assignment)}`);
    return { inputs, assignment, outputs: { f: bit === "x" ? "x" : Number(bit) } };
  });
  const { synthesize } = require("../quine");
  function analyze(vector) {
    const synthesis = synthesize(vector, variables);
    const onSet = Array.from(vector, (bit, index) => bit === "1" ? index : -1).filter(index => index >= 0);
    const primes = synthesis.allCoveringImplicants.map(prime => ({
      values: prime.implicantValue,
      symbols: prime.implicantSymbol,
      literalCount: prime.implicantSymbol.filter(bit => bit !== "-").length
    }));
    // Native `essential` also includes terms forced after dominance reduction.
    // The full chart alone defines the original function's essential primes.
    const essentials = primes.filter(prime => onSet.some(index =>
      prime.values.includes(index) && primes.every(other => other === prime || !other.values.includes(index))));
    const selected = synthesis.coverSymbolic.map(term => {
      const prime = primes.find(candidate => candidate.symbols.join("") === term.implicantSymbol.join(""));
      if (!prime) fail("native synthesis selected an unknown prime");
      return prime;
    });
    for (let index = 0; index < vector.length; index++) {
      if (vector[index] === "x") continue;
      const inputs = rows[index].inputs;
      const covered = selected.some(prime => prime.symbols.every((bit, position) => bit === "-" || Number(bit) === inputs[position]));
      if (covered !== (vector[index] === "1")) fail(`native synthesis does not cover table correctly at row ${index}`);
    }
    return { synthesis, primes, essentials, selected, onSet,
      statistics: coverStatistics(primes, onSet, essentials, selected.length) };
  }
  const result = analyze(options.table);
  const { synthesis, primes, essentials, selected, onSet, statistics } = result;
  const formula = prime => prime.symbols.map((bit, index) =>
    bit === "-" ? "" : bit === "1" ? variableLatex(variables[index]) : `\\bar{${variableLatex(variables[index])}}`).filter(Boolean).join(" ") || "1";
  const label = indices => `(${indices.join(",")})`;
  const essentialCoverage = new Set(essentials.flatMap(prime => prime.values));
  const uncovered = onSet.filter(index => !essentialCoverage.has(index));
  const values = Object.assign({
    variablesLatex: variables.map(variableLatex).join(", "), variableCount: variables.length,
    primeCount: primes.length, essentialCount: essentials.length, nonessentialCount: primes.length - essentials.length,
    essentialLatex: essentials.map(formula).join(", "), primeLatex: primes.map(formula).join(", "),
    solutionCount: selected.length, solutionLiteralCount: selected.reduce((sum, prime) => sum + prime.literalCount, 0),
    additionalCount: selected.filter(prime => !essentials.includes(prime)).length,
    uncoveredCount: uncovered.length, uncoveredLatex: uncovered.join(", "),
    allEssential: essentials.length === primes.length, essentialsCover: uncovered.length === 0,
    solutionLatex: synthesis.quicksynth,
    onSetLatex: onSet.join(", "), dcSetLatex: Array.from(options.table, (bit, index) => bit === "x" ? index : -1).filter(index => index >= 0).join(", "),
    canonicalLatex: onSet.map(index => formula({ symbols: rows[index].inputs.map(String) })).join(" + ") || "0",
    truthTable: table([...variables, "f", ""], rows.map(row => [...row.inputs, row.outputs.f, row.outputs.f === 1 ? "$\\leftarrow$" : ""])),
    primeLabels: primes.map(prime => label(prime.values)).join(", ")
  }, statistics);
  const charts = synthesis.implicantsCharts;
  const dominancePairs = [];
  if (charts.length > 1) {
    const [first, second] = charts;
    for (const removed of first.rows) {
      if (essentials.some(prime => label(prime.values) === label(removed)) || second.rows.some(row => label(row) === label(removed))) continue;
      const remaining = removed.filter(index => second.cols.includes(index));
      if (!remaining.length) continue;
      const dominating = second.rows.find(row => remaining.every(index => row.includes(index)));
      if (dominating) dominancePairs.push({ dominating, dominated: removed });
    }
  }
  values.dominatingLabels = dominancePairs.map(pair => label(pair.dominating)).join(", ");
  values.dominatedLabels = dominancePairs.map(pair => label(pair.dominated)).join(", ");
  values.secondaryEssentialCount = new Set(charts.slice(1).flatMap(chart => chart.highlight.map(item => label(item.row)))).size;
  if (expression) values.expressionLatex = latex(expression);
  const groups = synthesis.implicantsTables;
  const orderZero = groups[0] || [], orderOne = groups[1] || [];
  const implicantTable = (group, marked) => table([...(marked ? [""] : []), "impl. numero", ...variables],
    group.map(implicant => [...(marked ? [implicant.prime ? "" : "$\\checkmark$"] : []),
      label(implicant.values), ...implicant.string.map(bit => bit === "-" ? "\\-" : bit)]));
  values.orderZeroTable = implicantTable(orderZero, false);
  values.markedOrderZeroTable = implicantTable(orderZero, true);
  values.orderOneTable = implicantTable(orderOne, false);
  values.reductionPairs = orderOne.map(implicant =>
    `- la coppia ${implicant.values.map(index => label([index])).join(" e ")}, che dà luogo ad una riduzione $${implicant.string.join("")}$`).join("\n") || "nessuna";
  const nonReducible = [];
  for (let left = 0; left < orderZero.length; left++) {
    for (let right = left + 1; right < orderZero.length; right++) {
      const a = orderZero[left], b = orderZero[right];
      if (!orderOne.some(implicant => a.values.every(index => implicant.values.includes(index)) && b.values.every(index => implicant.values.includes(index)))) {
        nonReducible.push(`${label(a.values)} e ${label(b.values)}`);
      }
    }
  }
  values.nonReduciblePairs = nonReducible.join("; ") || "nessuna";
  values.reductionOrderCount = Math.max(0, groups.length - 1);
  values.reductionTableCount = groups.length;
  values.nextReductionCount = (groups[2] || []).length;
  const withoutDc = options.table.includes("x") ? analyze(options.table.replace(/x/g, "0")).statistics : statistics;
  values.withoutDcTermCount = withoutDc.minimumTermCount;
  values.withoutDcLiteralCount = withoutDc.minimumLiteralCount;
  values.dcTermSavings = withoutDc.minimumTermCount - statistics.minimumTermCount;
  values.dcLiteralSavings = withoutDc.minimumLiteralCount - statistics.minimumLiteralCount;
  if (timing) {
    // Balanced fan-in trees; complemented literals are supplied, NOT delay excluded.
    const levels = (inputs, fanIn) => {
      let depth = 0;
      while (inputs > 1) { inputs = Math.ceil(inputs / fanIn); depth++; }
      return depth;
    };
    const andLevels = Math.max(0, ...selected.map(prime => levels(prime.literalCount, timing.andFanIn)));
    const orLevels = levels(selected.length, timing.orFanIn);
    const totalDelay = andLevels * timing.andDelay + orLevels * timing.orDelay;
    if (!Number.isFinite(totalDelay)) fail("timing total delay must be finite");
    Object.assign(values, timing, { andLevels, orLevels, totalDelay,
      timingLatex: `${andLevels}\\cdot ${timing.andDelay} + ${orLevels}\\cdot ${timing.orDelay} = ${totalDelay}` });
  }
  return { values, variables, rows, costs: {}, netlists: [], minimization: { table: options.table, synthesis } };
}

function generateModel(raw) {
  const options = mapping(raw, "generate");
  if (options.kind === "minimize") return minimizeModel(options);
  keys(options, ["kind", "variables", "expressions", "columns", "steps", "checks", "costs", "parameters", "specification", "netlists", "restrictions", "variableLabels", "latexVariants"], "generate");
  const kind = options.kind === undefined ? "boolean" : options.kind;
  if (kind !== "boolean" && kind !== "prose") fail("kind must be boolean, prose or minimize");
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
  const compiledExpressions = Object.fromEntries(expressionNames.map(name => [name, {
    verilog: verilog(asts[name]), latex: latex(asts[name])
  }]));
  return { values, variables, rows, costs, netlists, compiledExpressions };
}

module.exports = { generateModel, MAX_VARIABLES, MAX_MINIMIZE_VARIABLES };
