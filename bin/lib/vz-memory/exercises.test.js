"use strict";

/* global describe, it, beforeEach, afterEach */
const { expect } = require("chai");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yaml = require("js-yaml");
const { generate } = require("./exercises");

describe("inline memory exercise collection", () => {
  let directory, input, output, manifest, doc;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "vzpac-memory-"));
    input = path.join(directory, "memory.yml");
    output = path.join(directory, "generated", "chapter.md");
    manifest = path.join(directory, "figure's $(touch injected)", "assets.yml");
    fs.writeFileSync(path.join(directory, "chapter.md"), "> [!exercise]\n> ${lat.exercise}\n\n${address.exercise}\n");
    fs.writeFileSync(path.join(directory, "latency.md"), ["---", "intro: 'Latency ${id}'", "---",
      "${intro}", "${eta}+${nu}(1-\\rho) ${operator} ${target}", "\\rho ${hitOperator} ${threshold}; ${rhoDomain}"].join("\n"));
    fs.writeFileSync(path.join(directory, "address.md"), ["---", "intro: 'Address ${id}'", "---",
      "${memorySize}/${cacheSize}: ${membits}=${tagbits}+${indexbits}+${blockbits}; ${blocks} blocks; ${wordsPerBlock} words",
      "![geometry](${assets}.pdf)"].join("\n"));
    doc = { mode: "inline", chapter: "chapter.md", tag: "memory", sections: [{ title: "Memory", exercises: [
      { id: "lat", template: "latency.md", generate: { kind: "latency", eta: 4, nu: 100, target: "cacheless", relation: "le", unit: "ns" } },
      { id: "address", asset_name: "historical-figure", template: "address.md",
        generate: { kind: "address", memoryBytes: 4294967296, cacheBytes: 1024, blockBytes: 32, wordBits: 32 } }
    ] }] };
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  function generateFixture() {
    fs.writeFileSync(input, yaml.dump(doc));
    generate(input, output, manifest);
    return fs.readFileSync(output, "utf8");
  }


  it("composes latency and geometry with cache associativity's observable conflict behavior", () => {
    for (const ways of [1, 2, 4]) {
      const id = `cache${ways}`;
      fs.appendFileSync(path.join(directory, "chapter.md"), `\${${id}.assets} ways=\${${id}.ways} hits=\${${id}.hits} blocks=\${${id}.blocks}\n`);
      doc.sections[0].exercises.push({ id, generate: { kind: "cache", seed: "memory", membits: 6, blockbits: 2,
        blocks: 4, ways, accesses: ["000000", "010000", "000000", "100000", "010000"] } });
    }
    const markdown = generateFixture();
    expect(markdown).to.include("ways=1 hits=0 blocks=4");
    expect(markdown).to.include("ways=2 hits=1 blocks=4");
    expect(markdown).to.include("ways=4 hits=2 blocks=4");
  });

  for (const [name, change] of [
    ["bad later geometry", value => { value.sections[0].exercises[1].generate.blockBytes = 3; }],
    ["unknown latency option", value => { value.sections[0].exercises[0].generate.seed = 2; }],
    ["invalid comparator", value => { value.sections[0].exercises[0].generate.relation = "eq"; }],
    ["non-numeric latency", value => { value.sections[0].exercises[0].generate.eta = "4"; }],
    ["unsafe asset basename", value => { value.sections[0].exercises[1].asset_name = "../escape"; }],
    ["unsafe exercise ID", value => { value.sections[0].exercises[1].id = "../escape"; }],
    ["unknown model placeholder", () => fs.appendFileSync(path.join(directory, "latency.md"), "${missing}")]
  ]) {
    it(`rejects ${name} before replacing either output`, () => {
      generateFixture();
      const before = [output, manifest].map(filename => fs.readFileSync(filename, "utf8"));
      change(doc);
      expect(generateFixture).to.throw();
      expect([output, manifest].map(filename => fs.readFileSync(filename, "utf8"))).to.deep.equal(before);
    });
  }
});
