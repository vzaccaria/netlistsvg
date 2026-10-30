"use strict";

/* global describe, it */
const { expect } = require("chai");
const { generateModel, MAX_VARIABLES } = require("./model");

function base(extra = {}) {
  return Object.assign({ variables: ["a", "b", "c"], expressions: { original: "a & b | b & ~c", simplified: "b & (a | ~c)" } }, extra);
}
function cells(markdown) {
  return markdown.split("\n").slice(2).map(line => line.split("|").slice(1, -1).map(cell => cell.trim()));
}

describe("bounded Boolean exercise model", () => {
  it("enumerates declared variables MSB first and observes NOT/AND/XOR/OR precedence", () => {
    const model = generateModel(base({ variables: ["c", "a", "b"], expressions: { f: "~a & b ^ c | a & ~b" } }));
    expect(model.rows.map(row => row.inputs)).to.deep.equal([
      [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]
    ]);
    expect(model.rows.map(row => row.outputs.f)).to.deep.equal([0, 1, 1, 0, 1, 0, 1, 1]);
  });

  it("supports constants, repeated negation, underscored identifiers and the zero-input domain", () => {
    expect(generateModel({ variables: [], expressions: { f: "~0 & 1" } }).rows.map(row => row.outputs.f)).to.deep.equal([1]);
    const model = generateModel({ variables: ["input_0"], expressions: { f: "~~input_0 ^ 1" } });
    expect(model.rows.map(row => row.outputs.f)).to.deep.equal([1, 0]);
    expect(model.values.variablesLatex).to.equal("input_{0}");
  });

  it("accepts the enumeration boundary and rejects excess variables before parsing expressions", () => {
    const variables = Array.from({ length: MAX_VARIABLES }, (_, index) => `x${index}`);
    const model = generateModel({ variables, expressions: { f: variables.join(" ^ ") } });
    expect(model.rows[0].outputs.f).to.equal(0);
    expect(model.rows[1].outputs.f).to.equal(1);
    expect(model.rows[2 ** MAX_VARIABLES - 1].outputs.f).to.equal(MAX_VARIABLES % 2);
    expect(() => generateModel({ variables: [...variables, "extra"], expressions: { f: "invalid syntax" } })).to.throw(/at most 10/);
  });

  it("checks every supplied proof step and independent identity over the full domain", () => {
    const expressions = { original: "~(a | b)", demorgan: "~a & ~b", alternate: "~b & ~a" };
    generateModel(base({ expressions, steps: [
      { expression: "original" }, { expression: "demorgan", reason: "De Morgan" }
    ], checks: [["demorgan", "alternate"]] }));
    expect(() => generateModel(base({ expressions: { first: "a", second: "a & ~b" }, steps: [
      { expression: "first", reason: "Ipotesi" }, { expression: "second", reason: "Passaggio errato" }
    ] }))).to.throw(/differ for.*"a":1.*"b":1/);
    expect(() => generateModel(base({ checks: [["original", "bad"]], expressions: { original: "a", bad: "~a" } }))).to.throw(/differ for/);
  });

  it("derives arithmetic truth from divisor and explicit zero convention", () => {
    const options = { variables: ["a", "b", "c", "d"],
      specification: { kind: "multiple", divisor: 4, includeZero: false, expression: "f" } };
    function selected() { return generateModel(options).rows.flatMap((row, index) => row.outputs.f ? [index] : []); }
    expect(selected()).to.deep.equal([4, 8, 12]);
    options.specification.includeZero = true;
    expect(selected()).to.deep.equal([0, 4, 8, 12]);
    options.specification.divisor = 3;
    expect(selected()).to.deep.equal([0, 3, 6, 9, 12, 15]);
    options.specification.includeZero = false;
    expect(selected()).to.deep.equal([3, 6, 9, 12, 15]);
    options.specification.divisor = 17;
    expect(selected()).to.deep.equal([]);
    options.specification.includeZero = true;
    expect(selected()).to.deep.equal([0]);
    options.specification.divisor = 1;
    options.variables = [];
    expect(selected()).to.deep.equal([0]);
    options.specification.includeZero = false;
    expect(selected()).to.deep.equal([]);
  });

  it("renders answer and blank tables with matching input rows and independently computed intermediate columns", () => {
    const model = generateModel(base({ columns: [
      { label: "$ab$", expression: "a & b", gray: true }, { label: "$f$", expression: "original" }
    ] }));
    const answers = cells(model.values.truthTable), blank = cells(model.values.blankTruthTable);
    expect(answers.map(row => row.slice(0, 3))).to.deep.equal(model.rows.map(row => row.inputs.map(String)));
    expect(answers.map(row => row[3])).to.deep.equal([0, 0, 0, 0, 0, 0, 1, 1].map(bit => `$\\color{gray}{${bit}}$`));
    expect(answers.map(row => row[4])).to.deep.equal(["0", "0", "1", "0", "0", "0", "1", "1"]);
    expect(blank).to.deep.equal(model.rows.map(row => [...row.inputs.map(String), "", ""]));
  });

  it("preserves mathematical grouping and variable-only display variants without changing truth values", () => {
    const model = generateModel({ variables: ["s", "i_0", "i_1"], expressions: { original: "~s & i_0 | s & i_1", grouped: "~(s | i_0) & i_1" },
      variableLabels: ["$s_0$", "$i_0$", "$i_1$"], latexVariants: { bit: { i_0: "i_0\\vert_k", i_1: "i_1\\vert_k" } } });
    expect(model.values.originalBitLatex).to.include("i_0\\vert_k").and.include("i_1\\vert_k");
    expect(model.values.groupedLatex).to.include("\\overline{s + i_{0}}");
    expect(model.values.groupedFunctionalLatex).to.include("\\operatorname{NOT}\\left(\\operatorname{OR}");
    expect(model.values.truthTable.split("\n")[0]).to.equal("| $s_0$ | $i_0$ | $i_1$ | $original$ | $grouped$ |");
    expect(model.rows.map(row => row.outputs.original)).to.deep.equal([0, 0, 1, 1, 0, 1, 0, 1]);
    const grouped = generateModel(base({ expressions: { f: "a & (b | c)" } }));
    expect(grouped.values.fLatex).to.include("\\left(b + c\\right)");
  });

  it("counts flattened n-input gates and binary fan-in separately, excluding NOT and wiring", () => {
    const model = generateModel(base({ expressions: {
      sop: "~a & b & ~c | a & b & ~c | a & b & c", reduced: "b & ~c | a & b", wire: "~a", zero: "0",
      factored: "~a & (b | c)", three: "~a & c | ~a & b | b & c"
    }, costs: ["sop", "reduced", "wire", "zero", "factored", "three"] }));
    expect(model.costs.sop).to.deep.equal({ gateCount: 4, literalCount: 9, inputCount: 12, binaryGateCount: 8, binaryInputCount: 16 });
    expect(model.costs.reduced).to.deep.equal({ gateCount: 3, literalCount: 4, inputCount: 6, binaryGateCount: 3, binaryInputCount: 6 });
    expect(model.costs.wire).to.deep.equal({ gateCount: 0, literalCount: 1, inputCount: 0, binaryGateCount: 0, binaryInputCount: 0 });
    expect(model.costs.zero).to.deep.equal({ gateCount: 0, literalCount: 0, inputCount: 0, binaryGateCount: 0, binaryInputCount: 0 });
    expect(model.costs.factored).to.deep.equal({ gateCount: 2, literalCount: 3, inputCount: 4, binaryGateCount: 2, binaryInputCount: 4 });
    expect(model.costs.three).to.deep.equal({ gateCount: 4, literalCount: 6, inputCount: 9, binaryGateCount: 5, binaryInputCount: 10 });
  });

  it("enforces gate restrictions independently of Boolean equivalence", () => {
    generateModel(base({ expressions: { original: "a & b", restricted: "~(~a | ~b)" }, checks: [["original", "restricted"]],
      restrictions: [{ expression: "restricted", allowed: ["not", "or"] }] }));
    expect(() => generateModel(base({ restrictions: [{ expression: "original", allowed: ["not", "or"] }] }))).to.throw(/forbidden and/);
  });

  it("permits explicitly unanswered prose with meaningful geometry and no inferred encoder assumption", () => {
    const model = generateModel({ kind: "prose", parameters: { inputBits: 4, outputBits: 2 } });
    expect(model.netlists).to.deep.equal([]);
    expect(model.costs).to.deep.equal({});
    expect(() => generateModel({ kind: "prose" })).to.throw(/requires meaningful/);
  });

  const malformed = [
    ["non-mapping", () => null, /mapping/],
    ["array mapping", () => [], /mapping/],
    ["unknown kind", () => base({ kind: "encoder" }), /kind/],
    ["unknown option", () => base({ simplify: true }), /unknown option/],
    ["missing variables", () => ({ expressions: { f: "1" } }), /variables/],
    ["duplicate variable", () => base({ variables: ["a", "a"] }), /duplicate identifier/],
    ["invalid identifier", () => base({ variables: ["a;exit"] }), /invalid identifier/],
    ["missing expressions", () => ({ variables: [] }), /expressions/],
    ["empty expressions", () => base({ expressions: {} }), /between 1/],
    ["array expressions", () => base({ expressions: [] }), /mapping/],
    ["excess expressions", () => base({ expressions: Object.fromEntries(Array.from({ length: 129 }, (_, i) => [`f${i}`, "a"])) }), /between 1/],
    ["invalid expression name", () => base({ expressions: { "f.x": "a" } }), /expression name/],
    ["nonstring expression", () => base({ expressions: { f: true } }), /non-empty string/],
    ["unknown variable", () => base({ expressions: { f: "x" } }), /unknown variable/],
    ["unclosed parentheses", () => base({ expressions: { f: "(a | b" } }), /expected/],
    ["implicit multiplication", () => base({ expressions: { f: "a b" } }), /unexpected/],
    ["binary number", () => base({ expressions: { f: "10" } }), /unexpected/],
    ["function call", () => base({ expressions: { f: "a(b)" } }), /unexpected/],
    ["JavaScript", () => base({ expressions: { f: "a; process.exit()" } }), /unexpected/],
    ["double operator", () => base({ expressions: { f: "a && b" } }), /expected/],
    ["excess length", () => base({ expressions: { f: "a".repeat(4097) } }), /4096/],
    ["excess nesting", () => base({ expressions: { f: "~".repeat(65) + "a" } }), /nesting/],
    ["excess nodes", () => base({ expressions: { f: Array(514).fill("a").join("|") } }), /1024 nodes/],
    ["array parameters", () => base({ parameters: [] }), /mapping/],
    ["nested parameter", () => base({ parameters: { size: {} } }), /finite scalar/],
    ["nonfinite parameter", () => base({ parameters: { size: Infinity } }), /finite scalar/],
    ["reserved placeholder", () => base({ parameters: { source: "wrong" } }), /collision/],
    ["derived value collision", () => base({ parameters: { originalGateCount: 3 }, costs: ["original"] }), /collision/],
    ["step mapping", () => base({ steps: ["original"] }), /mapping/],
    ["unknown proof expression", () => base({ steps: [{ expression: "missing", reason: "test" }] }), /unknown expression/],
    ["missing proof reason", () => base({ steps: [{ expression: "original" }, { expression: "simplified" }] }), /reason/],
    ["malformed check", () => base({ checks: [["original"]] }), /pair/],
    ["unknown check expression", () => base({ checks: [["original", "missing"]] }), /unknown expression/],
    ["unknown cost expression", () => base({ costs: ["missing"] }), /unknown expression/],
    ["duplicate costs", () => base({ costs: ["original", "original"] }), /duplicates/],
    ["undefined XOR cost", () => base({ expressions: { f: "a ^ b" }, costs: ["f"] }), /XOR cost/],
    ["invalid gate", () => base({ restrictions: [{ expression: "original", allowed: ["nand"] }] }), /unique not/],
    ["duplicate gates", () => base({ restrictions: [{ expression: "original", allowed: ["and", "and"] }] }), /unique not/],
    ["invalid column mapping", () => base({ columns: [null] }), /mapping/],
    ["missing column expression", () => base({ columns: [{ label: "f" }] }), /non-empty string/],
    ["table pipe", () => base({ columns: [{ label: "a|b", expression: "original" }] }), /without pipes/],
    ["gray type", () => base({ columns: [{ label: "f", expression: "original", gray: 1 }] }), /boolean/],
    ["variable header count", () => base({ variableLabels: ["a"] }), /every variable/],
    ["unknown display variable", () => base({ latexVariants: { bit: { missing: "x" } } }), /unknown variable/],
    ["display value collision", () => base({ latexVariants: { functional: {} } }), /collision/],
    ["bad specification kind", () => base({ specification: { kind: "odd" } }), /kind/],
    ["zero divisor", () => base({ specification: { kind: "multiple", divisor: 0 } }), /positive safe integer/],
    ["fractional divisor", () => base({ specification: { kind: "multiple", divisor: 1.5 } }), /positive safe integer/],
    ["missing zero convention", () => base({ specification: { kind: "multiple", divisor: 4 } }), /includeZero/],
    ["missing derived expression name", () => base({ specification: { kind: "multiple", divisor: 4, includeZero: false } }), /expression name/],
    ["conflicting arithmetic expression", () => base({ specification: { kind: "multiple", divisor: 4, includeZero: false, expression: "original" } }), /conflicts/],
    ["nonboolean zero convention", () => base({ specification: { kind: "multiple", divisor: 4, includeZero: "no", expression: "f" } }), /boolean/]
  ];
  for (const [label, make, error] of malformed) it(`rejects ${label}`, () => expect(() => generateModel(make())).to.throw(error));

  for (const field of ["columns", "steps", "checks", "costs", "netlists", "restrictions"]) {
    it(`rejects non-array ${field}`, () => expect(() => generateModel(base({ [field]: {} }))).to.throw(/must be an array/));
    it(`bounds the number of ${field}`, () => expect(() => generateModel(base({ [field]: Array(129).fill(null) }))).to.throw(/at most 128/));
  }
  for (const [field, entry] of [
    ["columns", { label: "f", expression: "original", manual: true }],
    ["steps", { expression: "original", reason: "Definizione", manual: true }],
    ["restrictions", { expression: "original", allowed: ["and", "or", "not"], manual: true }]
  ]) it(`rejects unknown ${field} metadata`, () => expect(() => generateModel(base({ [field]: [entry] }))).to.throw(/unknown option/));

  it("rejects unknown arithmetic specification metadata", () => {
    expect(() => generateModel({ variables: [], specification: {
      kind: "multiple", divisor: 1, includeZero: true, expression: "f", manual: true
    } })).to.throw(/unknown option/);
  });

  it("bounds and validates display variants and their labels", () => {
    expect(() => generateModel(base({ latexVariants: Array(1) }))).to.throw(/mapping/);
    expect(() => generateModel(base({ latexVariants: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`v${i}`, {}])) }))).to.throw(/at most 16/);
    expect(() => generateModel(base({ latexVariants: { "not-valid": {} } }))).to.throw(/variant name/);
    expect(() => generateModel(base({ latexVariants: { bit: { a: "" } } }))).to.throw(/non-empty/);
    expect(() => generateModel(base({ latexVariants: { bit: { a: "a".repeat(1025) } } }))).to.throw(/1024/);
  });

  it("checks a separately supplied historical expression against the derived predicate", () => {
    const options = { variables: ["a", "b", "c", "d"], specification: {
      kind: "multiple", divisor: 4, includeZero: false, expression: "derived"
    }, expressions: { historical: "(a | b) & ~c & ~d" }, checks: [["derived", "historical"]] };
    generateModel(options);
    options.specification.includeZero = true;
    expect(() => generateModel(options)).to.throw(/differ for.*"a":0.*"d":0/);
  });

  const netlist = extra => base({ netlists: [Object.assign({ id: "diagram", mode: "simple", outputs: { f: "original" } }, extra)] });
  for (const [label, make, error] of [
    ["traversal", () => netlist({ id: "../escape" }), /safe asset basename/],
    ["shell filename", () => netlist({ id: "$(touch injected)" }), /safe asset basename/],
    ["mode", () => netlist({ mode: "sequential" }), /simple or aig/],
    ["unknown port", () => netlist({ variables: ["x"] }), /subset/],
    ["omitted port", () => netlist({ variables: ["a", "b"] }), /omits input c/],
    ["duplicate port", () => netlist({ variables: ["a", "b", "a"] }), /duplicate identifier/],
    ["output/input collision", () => netlist({ outputs: { a: "original" } }), /collides/],
    ["keyword", () => netlist({ outputs: { initial: "original" } }), /invalid Verilog port/],
    ["output syntax", () => netlist({ outputs: { "f;": "original" } }), /invalid Verilog port/],
    ["unknown output expression", () => netlist({ outputs: { f: "missing" } }), /unknown expression/],
    ["empty outputs", () => netlist({ outputs: {} }), /non-empty/],
    ["duplicate diagram", () => base({ netlists: [netlist().netlists[0], netlist().netlists[0]] }), /duplicate netlist/],
    ["unknown diagram field", () => netlist({ script: "synth" }), /unknown option/]
  ]) it(`rejects netlist ${label}`, () => expect(() => generateModel(make())).to.throw(error));
});

describe("native Quine exercise model", () => {
  const minimize = (table, extra = {}) => generateModel(Object.assign({
    kind: "minimize", variables: ["a", "b", "c"], table
  }, extra));

  it("counts distinct minimum covers of a cyclic chart without inventing essentials", () => {
    const model = minimize("01111110");
    expect(model.values.primeCount).to.equal(6);
    expect(model.values.essentialCount).to.equal(0);
    expect(model.values.uncoveredCount).to.equal(6);
    expect(model.values.minimumTermCount).to.equal(3);
    expect(model.values.minimumCoverCount).to.equal(2);
    expect(model.values.minimumLiteralCount).to.equal(6);
    expect(model.values.minimumLiteralCoverCount).to.equal(2);
    for (const [index, row] of model.rows.entries()) {
      const covered = model.minimization.synthesis.coverSymbolic.some(term =>
        term.implicantSymbol.every((bit, position) => bit === "-" || Number(bit) === row.inputs[position]));
      expect(covered, `row ${index}`).to.equal(row.outputs.f === 1);
    }
  });

  it("excludes don't-care-only primes and measures actual don't-care simplification", () => {
    const model = minimize("1x00000x");
    expect(model.values.primeCount).to.equal(1);
    expect(model.values.essentialCount).to.equal(1);
    expect(model.values.solutionLiteralCount).to.equal(2);
    expect(model.values.dcTermSavings).to.equal(0);
    expect(model.values.dcLiteralSavings).to.equal(1);
    expect(model.values.minimumCoverCount).to.equal(1);
    expect(minimize("xxxxxxxx").values.solutionCount).to.equal(0);
    expect(minimize("00000000").values.minimumLiteralCount).to.equal(0);
    expect(minimize("11111111").values.solutionLatex).to.equal("1");
  });

  it("checks the independent expression on care rows in declared variable order", () => {
    const model = minimize("01x1", { variables: ["b", "a"], expression: "a" });
    expect(model.rows.map(row => row.inputs)).to.deep.equal([[0, 0], [0, 1], [1, 0], [1, 1]]);
    expect(() => minimize("01x1", { variables: ["b", "a"], expression: "b" })).to.throw(/expression differs.*row 1/);
  });

  it("keeps initial essentials separate from those introduced by dominance", () => {
    const model = minimize("0100111001000111", { variables: ["a", "b", "c", "d"] });
    expect(model.values.dominatingLabels).to.equal("(4,6), (14,15)");
    expect(model.values.dominatedLabels).to.equal("(4,5), (13,15)");
    expect(model.values.secondaryEssentialCount).to.equal(2);
    expect(model.values.essentialCount).to.equal(1);
  });

  it("derives the corrected fan-in-limited critical path from the selected cover", () => {
    const model = minimize("1011000110101110", { variables: ["a", "b", "c", "d"],
      timing: { andFanIn: 3, andDelay: 2, orFanIn: 3, orDelay: 3 } });
    expect(model.values.andLevels).to.equal(1);
    expect(model.values.orLevels).to.equal(2);
    expect(model.values.totalDelay).to.equal(8);
    const wire = minimize("00001111", { timing: { andFanIn: 2, andDelay: 2, orFanIn: 2, orDelay: 3 } });
    expect(wire.values.totalDelay).to.equal(0);
  });

  for (const [name, table, extra, error] of [
    ["unquoted vector", 10010011, {}, /quoted native/],
    ["foreign alphabet", "1001001-", {}, /quoted native/],
    ["short vector", "1001001", {}, /exactly 8/],
    ["overflow minterm", "x000x000x0x0x10x01xxx1xx001x0x001", { variables: ["a", "b", "c", "d", "e"] }, /exactly 32/],
    ["empty domain", "1", { variables: [] }, /1 to 6/],
    ["oversized domain", "1", { variables: ["a", "b", "c", "d", "e", "f", "g"] }, /1 to 6/],
    ["unbounded fan-in", "10010011", { timing: { andFanIn: 1, andDelay: 2, orFanIn: 3, orDelay: 3 } }, /andFanIn/],
    ["negative delay", "10010011", { timing: { andFanIn: 2, andDelay: -1, orFanIn: 3, orDelay: 3 } }, /andDelay/],
    ["unsupported fields", "10010011", { expressions: { f: "a" } }, /unknown option/]
  ]) it(`rejects ${name}`, () => expect(() => minimize(table, extra)).to.throw(error));
});
