"use strict";
/* global describe, it, beforeEach, afterEach */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yaml = require("js-yaml");
const { generate } = require("./exercises");

describe("ISA inline collections", function () {
  let root;
  beforeEach(function () { root = fs.mkdtempSync(path.join(os.tmpdir(), "isa-collection-test-")); });
  afterEach(function () { fs.rmSync(root, { recursive: true, force: true }); });
  function fixture(model, chapter) {
    fs.writeFileSync(path.join(root, "chapter.md"), chapter);
    fs.writeFileSync(path.join(root, "instances.yml"), yaml.dump({ mode: "inline", chapter: "chapter.md", tag: "isa-test", sections: [{ title: "Examples", exercises: [{ id: "example", generate: model }] }] }));
    return [path.join(root, "instances.yml"), path.join(root, "generated.md"), path.join(root, "assets.yml")];
  }

  it("rebases real links without interpreting assembly code spans or fenced examples as links", function () {
    const chapter = [
      "# ISA #slide-off #excluded",
      "| instruction | example |",
      "| --- | --- |",
      "| load | `lw rd, delta[11:0](rd)` |",
      "| jump | ``jalr x1, delta[11:0](x6) # ` literal`` |",
      "[`load`](assets/load.pdf) and [figure](assets/figure.svg)",
      "```asm",
      "lw rd, delta[11:0](rd)",
      '[literal](code-only.md) <img src="code-only.svg">',
      "```",
      "> [!note]",
      "> ````asm",
      "> jalr x1, delta[11:0](x6)",
      "> ```",
      "> [literal](callout-only.md)",
      "> ````",
      "> [real](assets/callout.pdf)",
      "~~~text",
      "[literal](tilde-only.md)",
      "~~~",
      "[reference]: assets/reference.pdf",
      '<img src="assets/image.svg">',
      "${example.asm}",
      ""
    ].join("\r\n");
    const paths = fixture({ kind: "fragment", reason: "Isolated instruction listing", fragments: { asm: "nop" } }, chapter);
    paths[1] = path.join(root, "generated", "chapter.md");
    generate(...paths);
    const expected = chapter.replace("(assets/load.pdf)", "(../assets/load.pdf)")
      .replace("(assets/figure.svg)", "(../assets/figure.svg)")
      .replace("(assets/callout.pdf)", "(../assets/callout.pdf)")
      .replace(": assets/reference.pdf", ": ../assets/reference.pdf")
      .replace('src="assets/image.svg"', 'src="../assets/image.svg"')
      .replace("${example.asm}", "nop");
    assert.strictEqual(fs.readFileSync(paths[1], "utf8"), expected);
  });

  it("ends an unclosed quoted fence at the quote boundary and preserves an unclosed outer fence", function () {
    const chapter = [
      "> ```asm",
      "> [literal](inside.md)",
      "[outside](outside.md)",
      "${example.asm}",
      "```asm",
      "[literal](unfinished.md)",
      ""
    ].join("\n");
    const paths = fixture({ kind: "fragment", reason: "Isolated instruction listing", fragments: { asm: "nop" } }, chapter);
    paths[1] = path.join(root, "generated", "chapter.md");
    generate(...paths);
    assert.strictEqual(fs.readFileSync(paths[1], "utf8"),
      chapter.replace("(outside.md)", "(../outside.md)").replace("${example.asm}", "nop"));
  });

  it("does not overwrite an existing chapter or manifest after an invalid execution contract", function () {
    const paths = fixture({ kind: "program", fragments: { asm: "nop" }, verify: [] }, "${example.asm}\n");
    fs.writeFileSync(paths[1], "previous verified chapter\n");
    fs.writeFileSync(paths[2], "previous verified manifest\n");
    assert.throws(() => generate(...paths), /requires nonempty verify/);
    assert.strictEqual(fs.readFileSync(paths[1], "utf8"), "previous verified chapter\n");
    assert.strictEqual(fs.readFileSync(paths[2], "utf8"), "previous verified manifest\n");
  });

  (process.env.VZPAC_NATIVE_TESTS === "1" ? it : it.skip)("derives answer changes from parameterized native execution and refuses mismatched variants", function () {
    this.timeout(180000);
    const model = { kind: "program", parameters: { increment: 7 }, fragments: { asm: "ld a0,x\naddi a0,a0,${increment}\nla t0,x\nsd a0,0(t0)" }, verify: [{ name: "initial", declarations: "int64_t x=-2;", asm: "${asm}", reference: "x+=${increment};", observe: [{ name: "x", type: "int64_t" }] }] };
    const paths = fixture(model, "Answer: ${example.value_x}\n");
    generate(...paths);
    assert.strictEqual(fs.readFileSync(paths[1], "utf8"), "Answer: 5\n");
    model.parameters.increment = 9;
    fixture(model, "Answer: ${example.value_x}\n");
    generate(...paths);
    assert.strictEqual(fs.readFileSync(paths[1], "utf8"), "Answer: 7\n");
    model.verify[0].reference = "x+=10;";
    fixture(model, "Answer: ${example.value_x}\n");
    const priorManifest = fs.readFileSync(paths[2], "utf8");
    assert.throws(() => generate(...paths), /native C\/assembly mismatch/);
    assert.strictEqual(fs.readFileSync(paths[1], "utf8"), "Answer: 7\n");
    assert.strictEqual(fs.readFileSync(paths[2], "utf8"), priorManifest);
  });
});
