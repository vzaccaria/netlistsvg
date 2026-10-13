"use strict";

/* global describe, it, beforeEach, afterEach */

const { expect } = require("chai");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yaml = require("js-yaml");
const { generate } = require("./exercises");

function quote(value) {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

// Execute the emitted entry with the real simulator, asking for JSON rather
// than compiling figures. No renderer or simulator mocks are involved.
function simulateEntry(entry) {
  const command = entry.steps[0]
    .replace(/^vzpac/, quote(process.execPath) + " " + quote(path.resolve(__dirname, "../../vzpac.js")))
    .replace(" -c -x {prefix}", "")
    .replace(/\{(\w+)\}/g, (match, name) => String(entry.vars[name]));
  return JSON.parse(childProcess.execSync(command, { shell: "/bin/bash", encoding: "utf8" }));
}

function removeDirectory(directory) {
  for (const item of fs.readdirSync(directory)) {
    const filename = path.join(directory, item);
    if (fs.statSync(filename).isDirectory()) removeDirectory(filename);
    else fs.unlinkSync(filename);
  }
  fs.rmdirSync(directory);
}

function explicitOptions() {
  return {
    membits: 8, blockbits: 2, blocks: 4, ways: 1,
    accesses: ["0001 00 00", "0001 01 00", "0001 01 01", "0010 00 00", "0001 00 00"],
    initial: [
      { valid: true, tag: "0001", data: 4 },
      { valid: false, tag: "0", data: 37 },
      { valid: false, tag: "0000", data: 2 },
      { valid: false, tag: "0011", data: 3 }
    ]
  };
}

describe("cache exercise generation", function () {
  // Real subprocesses load the full dispatcher, including unrelated renderers.
  this.timeout(60000);
  let directory;
  let input;
  let output;
  let manifest;
  let doc;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "vzpac-cache-"));
    input = path.join(directory, "cache.yml");
    output = path.join(directory, "generated elsewhere", "chapter.md");
    manifest = path.join(directory, "generated assets's", "assets.yml");
    fs.writeFileSync(path.join(directory, "chapter.md"), "---\ntitle: Cache\n---\n\n# Simulazione caches\n\n%% cache-exercises %%\n\n# Memoria virtuale\n");
    fs.writeFileSync(path.join(directory, "family.md"), [
      "---", "intro: Default cache question", "---", "### Esercizio", "",
      "%% slide ${tag}: %%", "${intro}", "",
      "![](${assets}-badge.svg){#fig-${id}-badge}",
      "![](${assets}-blank-trace.svg){#fig-${id}-blank-trace}",
      "%% [edit](${source}) %%", "%% /slide %%", "", "#### Soluzione", "",
      "> [!solution]-", "> ![](${assets}-cache-data.svg){#fig-${id}-cache-data}",
      "> ![](${assets}-complete-trace.svg){#fig-${id}-complete-trace}", ""
    ].join("\n"));
    fs.writeFileSync(path.join(directory, "base.yml"), yaml.dump({ mmu: { manual: true } }));
    doc = {
      template: "family.md", chapter: "chapter.md", base_assets: "base.yml", tag: "cache_slide",
      sections: [{ title: "Direct mapping", exercises: [{ id: "example", generate: explicitOptions() }] }]
    };
  });

  afterEach(() => removeDirectory(directory));

  function generateFixture() {
    fs.writeFileSync(input, yaml.dump(doc));
    generate(input, output, manifest);
    return yaml.load(fs.readFileSync(manifest, "utf8"));
  }

  it("preserves leading-zero tags and invalid initial fields through real simulation", () => {
    const trace = simulateEntry(generateFixture().example).simulation;
    expect(trace.results.actions[0].state).to.deep.equal([
      { valid: true, tag: "0001", data: 4 },
      { valid: false, tag: "0", data: 37 },
      { valid: false, tag: "0000", data: 2 },
      { valid: false, tag: "0011", data: 3 }
    ]);
    expect(trace.results.actions.slice(1).map(action => action.type)).to.deep.equal([
      "hit", "miss", "hit", "miss", "miss"
    ]);
    expect(trace.results.cache[0].tag).to.equal("0001");
    expect(trace.results.cache[0].data).to.equal(4);
  });

  it("uses the existing empty-cache and fully-associative LRU behavior", () => {
    doc.sections[0].exercises[0].generate = {
      membits: 8, blockbits: 2, blocks: 4, ways: 4,
      accesses: ["00000000", "00000100", "00001000", "00001100", "00000001", "00010000", "00000101"]
    };
    const trace = simulateEntry(generateFixture().example).simulation;
    expect(trace.results.actions[0].state).to.deep.equal([
      { valid: false }, { valid: false }, { valid: false }, { valid: false }
    ]);
    expect(trace.results.actions.slice(1).map(action => action.type)).to.deep.equal([
      "miss", "miss", "miss", "miss", "hit", "miss", "miss"
    ]);
    expect(trace.results.cache.map(block => block.data)).to.deep.equal([0, 4, 1, 3]);
  });

  it("reuses named YAML traces and initial states without changing either comparison", () => {
    fs.writeFileSync(input, [
      "template: family.md", "chapter: chapter.md", "base_assets: base.yml", "tag: cache_slide",
      "traces:", "  comparison: &comparison ['00000000', '00100000', '00000001']",
      "states:", "  empty: &empty [{valid: false, tag: '0', data: 0}, {valid: false, tag: '0', data: 0}]",
      "sections:", "  - title: Comparison", "    exercises:",
      "      - {id: direct, generate: {blocks: 2, ways: 1, membits: 8, blockbits: 4, accesses: *comparison, initial: *empty}}",
      "      - {id: associative, generate: {blocks: 2, ways: 2, membits: 8, blockbits: 4, accesses: *comparison, initial: *empty}}"
    ].join("\n"));
    generate(input, output, manifest);
    const entries = yaml.load(fs.readFileSync(manifest, "utf8"));
    const direct = simulateEntry(entries.direct).simulation;
    const associative = simulateEntry(entries.associative).simulation;
    expect(direct.trace.map(row => row.address)).to.deep.equal(["00000000", "00100000", "00000001"]);
    expect(associative.trace.map(row => row.address)).to.deep.equal(direct.trace.map(row => row.address));
    expect(direct.initial).to.deep.equal(associative.initial);
    expect(direct.trace.map(row => row.expected)).to.deep.equal(["miss", "miss", "miss"]);
    expect(associative.trace.map(row => row.expected)).to.deep.equal(["miss", "miss", "hit"]);
  });

  it("rejects a scalar CLI trace rather than generating unrelated accesses", () => {
    expect(() => childProcess.execFileSync(process.execPath, [
      path.resolve(__dirname, "../../vzpac.js"), "cache-new", "sim",
      "--seed=trace", "--trace=2", "--blocks", "2", "--ways", "1", "--membits", "8", "--blockbits", "2"
    ], { encoding: "utf8", stdio: "pipe" })).to.throw(Error);
  });

  it("keeps generated cases reproducible without requiring a seed in each row", () => {
    doc.sections[0].exercises[0] = {
      id: "example", generate: { ways: 2, membits: 12, blockbits: 4, accesses: 6, hits: 3 }
    };
    const first = simulateEntry(generateFixture().example).simulation;
    const second = simulateEntry(generateFixture().example).simulation;
    expect(second).to.deep.equal(first);
    expect(first.config.associativity).to.equal(2);
    expect(first.trace[0].expected).to.equal("miss");
    expect(first.trace.filter(row => row.expected === "hit")).to.have.lengthOf(3);
  });

  it("treats numeric seed zero and quoted seed zero as the same reproducible case", () => {
    const instance = { id: "example", generate: { seed: 0, ways: 1, hits: 2 } };
    doc.sections[0].exercises[0] = instance;
    const numeric = simulateEntry(generateFixture().example).simulation;
    instance.generate.seed = "0";
    expect(simulateEntry(generateFixture().example).simulation).to.deep.equal(numeric);
  });

  it("preserves option-like seeds as data rather than invoking CLI help", () => {
    doc.sections[0].exercises[0] = { id: "example", generate: { seed: "--help", ways: 1, hits: 2 } };
    const simulation = simulateEntry(generateFixture().example).simulation;
    expect(simulation.seed).to.equal("--help");
    expect(simulation.hitCount).to.equal(2);
  });

  [
    { name: "obsolete params alongside generate", instance: { params: explicitOptions(), generate: {} } },
    { name: "missing generate", instance: {} },
    { name: "unknown generator options", instance: { generate: { cacheways: 1 } } },
    { name: "fractional access counts", instance: { generate: { accesses: 4.5 } } },
    { name: "hits on every access of a cold cache", instance: { generate: { accesses: 3, hits: 3 } } },
    { name: "reversed hit bounds", instance: { generate: { minHits: 4, maxHits: 2 } } }
  ].forEach(example => {
    it(`rejects ${example.name} without replacing the last valid chapter or manifest`, () => {
      generateFixture();
      const previousOutput = fs.readFileSync(output, "utf8");
      const previousManifest = fs.readFileSync(manifest, "utf8");
      doc.sections[0].exercises[0] = Object.assign({ id: "example" }, example.instance);
      expect(generateFixture).to.throw(Error);
      expect(fs.readFileSync(output, "utf8")).to.equal(previousOutput);
      expect(fs.readFileSync(manifest, "utf8")).to.equal(previousManifest);
    });
  });

  it("keeps static chapter images readable through a symlinked output directory", () => {
    const physical = path.join(directory, "physical", "deep", "generated");
    const alias = path.join(directory, "linked");
    const image = path.join(directory, "static.svg");
    fs.mkdirSync(physical, { recursive: true });
    fs.symlinkSync(physical, alias, "dir");
    fs.writeFileSync(image, "<svg xmlns=\"http://www.w3.org/2000/svg\"/>");
    fs.appendFileSync(path.join(directory, "chapter.md"), "\n![static](static.svg)\n");
    output = path.join(alias, "chapter.md");
    try {
      generateFixture();
      const target = fs.readFileSync(output, "utf8").match(/!\[static\]\(([^)]+)\)/)[1];
      // Let the filesystem resolve '..' after the directory symlink.
      expect(fs.statSync(path.dirname(output) + path.sep + decodeURIComponent(target)).ino)
        .to.equal(fs.statSync(image).ino);
    } finally {
      fs.unlinkSync(alias);
    }
  });

  it("rejects duplicate instance IDs across sections without replacing previous outputs", () => {
    generateFixture();
    const previous = fs.readFileSync(output, "utf8");
    doc.sections.push({ title: "Associative", exercises: [{ id: "example", generate: explicitOptions() }] });
    expect(generateFixture).to.throw(Error);
    expect(fs.readFileSync(output, "utf8")).to.equal(previous);
    expect(simulateEntry(yaml.load(fs.readFileSync(manifest, "utf8")).example).simulation.results.actions[1].type).to.equal("hit");
  });

  it("rejects instance IDs colliding with base assets even when the manifest moves", () => {
    doc.sections[0].exercises[0].id = "mmu";
    expect(generateFixture).to.throw(Error);
  });

  [
    { name: "fractional dimensions", change: value => { value.membits = 8.5; } },
    { name: "negative dimensions", change: value => { value.blockbits = -1; } },
    { name: "ways exceeding the number of blocks", change: value => { value.ways = 8; } },
    { name: "cache exceeding memory", change: value => { value.membits = 3; } },
    { name: "unsupported block count", change: value => { value.blocks = 1; } },
    { name: "truncated addresses", change: value => { value.accesses[0] = "0001000"; } },
    { name: "non-binary addresses", change: value => { value.accesses[0] = "00010002"; } },
    { name: "unquoted addresses", change: value => { value.accesses[0] = 10000; } },
    { name: "truncated valid tags", change: value => { value.initial[0].tag = "001"; } },
    { name: "unquoted initial tags", change: value => { value.initial[0].tag = 1; } },
    { name: "incorrect initial block counts", change: value => { value.initial.pop(); } }
  ].forEach(example => {
    it(`rejects ${example.name}`, () => {
      example.change(doc.sections[0].exercises[0].generate);
      expect(generateFixture).to.throw(Error);
    });
  });

  it("rejects unknown family placeholders before overwriting either output", () => {
    generateFixture();
    const previousOutput = fs.readFileSync(output, "utf8");
    const previousManifest = fs.readFileSync(manifest, "utf8");
    fs.appendFileSync(path.join(directory, "family.md"), "\n${asset}\n");
    expect(generateFixture).to.throw(Error);
    expect(fs.readFileSync(output, "utf8")).to.equal(previousOutput);
    expect(fs.readFileSync(manifest, "utf8")).to.equal(previousManifest);
  });
});
