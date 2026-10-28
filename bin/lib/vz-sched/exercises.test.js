"use strict";

/* global describe, it, beforeEach, afterEach */
const { expect } = require("chai");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yaml = require("js-yaml");
const { generate } = require("./exercises");
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
const cli = path.resolve(__dirname, "../../vzpac.js");

function schedule() {
  return {
    timer: 0.5, runfor: 4,
    class: { type: "CFS", latency: 6, mingran: 0.75, wgup: 1 },
    initialrq: ["B", "A"],
    tasks: [
      { index: 0, name: "A", lambda: 1, start: 0, events: [4], vrt: 0 },
      { index: 1, name: "B", lambda: 1, start: 0, events: [4], vrt: 0 }
    ],
    graphics: { vspace: 1, hspace: 1, barheight: 0.5 }
  };
}

describe("CFS exercise collection", function () {
  this.timeout(30000);
  let directory, input, output, manifest, doc;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "vzpac-cfs-"));
    input = path.join(directory, "schedules.yml");
    output = path.join(directory, "generated", "chapter.md");
    manifest = path.join(directory, "figure's $(touch injected)", "assets.yml");
    fs.writeFileSync(path.join(directory, "chapter.md"), "# Scheduling\n\n${stable.exercise}\n${later.assets}\n");
    fs.writeFileSync(path.join(directory, "family.md"), [
      "---", "intro: 'Scheduling'", "---", "${intro}",
      "![](${assets}-rt-diagram.svg){#fig-${asset_name}-rt-diagram}", "${later.initialOrder}"
    ].join("\n"));
    const shared = schedule();
    doc = { mode: "inline", chapter: "chapter.md", template: "family.md", tag: "cfs", sections: [
      { title: "Schedules", exercises: [
        { id: "stable", asset_name: "legacy-name", generate: shared },
        { id: "later", template: null, generate: shared }
      ] }
    ] };
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  function generateFixture() {
    fs.writeFileSync(input, yaml.dump(doc));
    generate(input, output, manifest);
  }
  function commandFor(entry) {
    return entry.steps[0].replace(/^vzpac/, quote(process.execPath) + " " + quote(cli))
      .replace(" -c", "")
      .replace(/\{(\w+)\}/g, (match, key) => String(entry.vars[key]));
  }
  function materialize(id, entry) {
    const root = path.join(path.dirname(manifest), id);
    fs.mkdirSync(path.join(root, "assets"), { recursive: true });
    for (const [filename, value] of Object.entries(entry.inputs)) fs.writeFileSync(path.join(root, filename), JSON.stringify(value));
  }

  it("runs aliased native inputs through the CLI with safe paths and resolves historical image basenames", () => {
    generateFixture();
    const entries = yaml.load(fs.readFileSync(manifest, "utf8"));
    for (const [id, entry] of Object.entries(entries)) {
      materialize(id, entry);
      const command = commandFor(entry);
      // The expanded prefix is quoted and may contain spaces/metacharacters.
      const withoutSave = command.slice(0, command.lastIndexOf(" -s "));
      const history = JSON.parse(childProcess.execSync(withoutSave, { cwd: directory, shell: "/bin/bash", encoding: "utf8" }));
      expect(history.find(row => row.time === 0.5).rbt.find(task => task.R === "X")).to.include({ name: "B", sum: 0.5, vrt: 0.5 });
      childProcess.execSync(command, { cwd: directory, shell: "/bin/bash", encoding: "utf8" });
    }
    const markdown = fs.readFileSync(output, "utf8");
    const destination = markdown.match(/!\[\]\(([^)]+-rt-diagram.svg)\)/)[1];
    const tex = path.resolve(path.dirname(output), decodeURIComponent(destination)).replace(/\.svg$/, ".tex");
    expect(tex).to.equal(path.join(path.dirname(manifest), "stable", "assets", "legacy-name-rt-diagram.tex"));
    expect(fs.existsSync(tex)).to.equal(true);
    expect(fs.existsSync(path.join(directory, "injected"))).to.equal(false);
  });

  it("keeps the public sched exercises route distinct from the native positional JSON route", () => {
    fs.writeFileSync(input, yaml.dump(doc));
    childProcess.execFileSync(process.execPath, [cli, "sched", "exercises", input, "-o", output, "--manifest", manifest], { encoding: "utf8" });
    const entries = yaml.load(fs.readFileSync(manifest, "utf8"));
    materialize("stable", entries.stable);
    const native = JSON.parse(childProcess.execFileSync(process.execPath, [cli, "sched", path.join(path.dirname(manifest), "stable", "legacy-name.json")], { encoding: "utf8" }));
    expect(native.find(row => row.time === 3).rbt.find(task => task.R === "X").name).to.equal("A");
  });

  [
    { name: "traversing artifact basename", change: value => { value.sections[0].exercises[1].asset_name = "../escape"; } },
    { name: "shell-bearing artifact basename", change: value => { value.sections[0].exercises[1].asset_name = "$(touch injected)"; } },
    { name: "bad later scheduling data", change: value => { value.sections[0].exercises[1].generate = schedule(); value.sections[0].exercises[1].generate.timer = 0; } },
    { name: "unknown runqueue task", change: value => { value.sections[0].exercises[1].generate.initialrq = ["unknown"]; } }
  ].forEach(example => {
    it(`rejects ${example.name} before replacing either output`, () => {
      generateFixture();
      const previous = [fs.readFileSync(output, "utf8"), fs.readFileSync(manifest, "utf8")];
      example.change(doc);
      expect(generateFixture).to.throw(Error);
      expect([fs.readFileSync(output, "utf8"), fs.readFileSync(manifest, "utf8")]).to.deep.equal(previous);
    });
  });
});
