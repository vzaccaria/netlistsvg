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


function options(pages) {
  return {
    processes: ["p"], accesses: pages.map(npv => ({ process: "p", npv })),
    npvbits: 3, npfbits: 2, wsbits: 1, upto: 1, policy: "LRU"
  };
}

describe("MMU exercise collection", function () {
  this.timeout(60000);
  let directory;
  let input;
  let output;
  let manifest;
  let doc;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "vzpac-mmu-"));
    input = path.join(directory, "mmu.yml");
    output = path.join(directory, "generated elsewhere", "chapter.md");
    manifest = path.join(directory, "generated asset's", "assets.yml");
    fs.writeFileSync(path.join(directory, "chapter.md"), "# MMU\n\n%% mmu-exercises %%\n\n# Next topic\n");
    fs.writeFileSync(path.join(directory, "family.md"), [
      "---", "intro: 'Simulate ${policy}.'", "---", "### Exercise ${id}", "",
      "%% slide ${tag}: %%", "${intro}", "",
      "![](${assets}-${policyLower}-blank.svg){#fig-${id}-${policyLower}-blank}",
      "%% [edit](${source}) %%", "%% /slide %%", "", "#### Solution", "",
      "![](${assets}-lru.svg){#fig-${id}-lru}", "![](${assets}-fifo.svg){#fig-${id}-fifo}",
      "FIFO ${faultsFIFO} ${faultOperator} LRU ${faultsLRU}: ${faultRelation}.", "${commentary}", ""
    ].join("\n"));
    doc = { template: "family.md", chapter: "chapter.md", tag: "mmu_slide",
      sections: [{ title: "Exercises", exercises: [{ id: "example", generate: options([0, 1, 0, 2, 1]) }] }] };
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  function generateFixture() {
    fs.writeFileSync(input, yaml.dump(doc));
    generate(input, output, manifest);
    return yaml.load(fs.readFileSync(manifest, "utf8"));
  }


  it("saves every figure through a quoted manifest prefix containing shell metacharacters", () => {
    manifest = path.join(directory, "assets $(touch injected)'s", "assets.yml");
    const entry = generateFixture().example;
    fs.mkdirSync(path.join(path.dirname(manifest), "example", "assets"), { recursive: true });
    const command = entry.steps[0]
      .replace(/^vzpac/, quote(process.execPath) + " " + quote(path.resolve(__dirname, "../../vzpac.js")))
      .replace(" -c -x {prefix}", " -x {prefix}")
      .replace(/\{(\w+)\}/g, (match, name) => String(entry.vars[name]));
    childProcess.execSync(command, { cwd: directory, shell: "/bin/bash", encoding: "utf8" });
    for (const suffix of ["lru", "fifo", "lru-blank", "fifo-blank", "configurazione"]) {
      const filename = path.join(path.dirname(manifest), "example", "assets", `example-${suffix}.tex`);
      expect(fs.existsSync(filename), filename).to.equal(true);
    }
    expect(fs.existsSync(path.join(directory, "injected"))).to.equal(false);
  });


  it("rebases chapter links through the physical output and combines optional base assets", () => {
    const physical = path.join(directory, "physical", "deep", "generated");
    const alias = path.join(directory, "linked");
    fs.mkdirSync(physical, { recursive: true });
    fs.symlinkSync(physical, alias, "dir");
    output = path.join(alias, "chapter.md");
    const image = path.join(directory, "static image.svg");
    fs.writeFileSync(image, "<svg/>");
    fs.appendFileSync(path.join(directory, "chapter.md"), "\n![static](static%20image.svg)\n");
    fs.writeFileSync(path.join(directory, "base.yml"), yaml.dump({ other: { manual: true } }));
    doc.base_assets = "base.yml";
    const entries = generateFixture();
    const baseDirectory = Object.keys(entries).find(key => key !== "example");
    expect(path.resolve(path.dirname(manifest), baseDirectory)).to.equal(path.join(directory, "other"));
    const markdown = fs.readFileSync(output, "utf8");
    const link = markdown.match(/!\[static\]\(([^)]+)\)/)[1];
    expect(fs.statSync(path.dirname(output) + path.sep + decodeURIComponent(link)).ino).to.equal(fs.statSync(image).ino);
  });

  it("preserves footnote mathematics while rebasing reference-link destinations", () => {
    const formula = "$\\frac{m}{s^2}$";
    fs.appendFileSync(path.join(directory, "chapter.md"),
      `\nUnits[^units].\n\n[^units]: ${formula}\n\n[diagram]: static%20image.svg\n`);
    generateFixture();
    const markdown = fs.readFileSync(output, "utf8");
    expect(markdown.match(/^\[\^units\]:\s*(.*)$/m)[1]).to.equal(formula);
    const destination = markdown.match(/^\[diagram\]:\s*(.*)$/m)[1];
    expect(path.resolve(path.dirname(output), decodeURIComponent(destination)))
      .to.equal(path.join(directory, "static image.svg"));
  });

  [
    { name: "an invalid later exercise", change: value => { value.sections[0].exercises.push({ id: "bad", generate: options([8]) }); } },
    { name: "duplicate exercise IDs", change: value => { value.sections.push({ title: "Other", exercises: value.sections[0].exercises }); } },
    { name: "invalid heading levels", change: value => { value.sections[0].level = 7; } },
    { name: "unsafe exercise paths", change: value => { value.sections[0].exercises[0].id = "../escape"; } },
    { name: "absolute source paths", change: value => { value.template = path.join(directory, "family.md"); } },
    { name: "invalid commentary", change: value => { value.sections[0].exercises[0].commentary = 12; } },
    { name: "unknown template placeholders", change: () => { fs.appendFileSync(path.join(directory, "family.md"), "${missing}"); } },
    { name: "multiple chapter slots", change: () => { fs.appendFileSync(path.join(directory, "chapter.md"), "\n%% mmu-exercises %%\n"); } },
    { name: "colliding base directories", change: value => {
      value.base_assets = "base.yml";
      fs.writeFileSync(path.join(directory, "base.yml"), yaml.dump({ example: { manual: true } }));
    } }
  ].forEach(example => {
    it(`rejects ${example.name} without replacing either previous output`, () => {
      generateFixture();
      const previousMarkdown = fs.readFileSync(output, "utf8");
      const previousManifest = fs.readFileSync(manifest, "utf8");
      example.change(doc);
      expect(generateFixture).to.throw(Error);
      expect(fs.readFileSync(output, "utf8")).to.equal(previousMarkdown);
      expect(fs.readFileSync(manifest, "utf8")).to.equal(previousManifest);
    });
  });

  it("rejects output paths that would overwrite an input", () => {
    fs.writeFileSync(input, yaml.dump(doc));
    const source = fs.readFileSync(input, "utf8");
    expect(() => generate(input, input, manifest)).to.throw(/must not overwrite/);
    expect(fs.readFileSync(input, "utf8")).to.equal(source);
  });
});
