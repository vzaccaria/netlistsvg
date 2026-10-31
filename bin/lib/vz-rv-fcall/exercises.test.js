"use strict";
/* global describe, it, beforeEach, afterEach */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yaml = require("js-yaml");
const { spawnSync } = require("child_process");
const { generate } = require("./exercises");
const cli = path.resolve(__dirname, "../../vzpac.js");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", timeout: 180000 });
}
function success(args) {
  const result = run(args);
  assert.strictEqual(result.status, 0, `${result.error || ""}\n${result.stderr}\n${result.stdout}`);
  return result.stdout;
}

describe("rv-fcall inline collections", function () {
  let root;
  beforeEach(function () { root = fs.mkdtempSync(path.join(os.tmpdir(), "fcall-collection-test-")); });
  afterEach(function () { fs.rmSync(root, { recursive: true, force: true }); });

  function fixture(model) {
    fs.writeFileSync(path.join(root, "chapter.md"), "Answer ${call.value_result}; ${isa.asm}\n![stack](${call.nativeAssets}-complete-diagram.svg){#fig-kept}\n%% [edit](${call.source}) %%\n");
    fs.writeFileSync(path.join(root, "instances.yml"), yaml.dump({ mode: "inline", chapter: "chapter.md", tag: "calls", passthrough: ["isa"], sections: [{ title: "Calls", exercises: [{ id: "call", generate: model }] }] }));
    return [path.join(root, "instances.yml"), path.join(root, "generated", "fcall.md"), path.join(root, "assets", "assets.yml")];
  }

  it("leaves both published outputs untouched when a duplicate native source is supplied", function () {
    const args = fixture({ layout: { functionData: { name: "f", body: "old.s" } }, body: "ret", source: "void f(void) {}", referenceSymbol: "f", verify: [] });
    fs.mkdirSync(path.dirname(args[1]), { recursive: true });
    fs.mkdirSync(path.dirname(args[2]), { recursive: true });
    fs.writeFileSync(args[1], "previous chapter");
    fs.writeFileSync(args[2], "previous manifest");
    assert.throws(() => generate(...args), /provide inline body\/source/);
    assert.strictEqual(fs.readFileSync(args[1], "utf8"), "previous chapter");
    assert.strictEqual(fs.readFileSync(args[2], "utf8"), "previous manifest");
  });

  (process.env.VZPAC_NATIVE_TESTS === "1" ? it : it.skip)("composes the real fcall and ISA CLIs and refuses publication on native disagreement", function () {
    this.timeout(180000);
    const model = {
      layout: { stackgrows: "down", omitFramePointer: true, functionData: { name: "f", isLeaf: true, parameters: ["x/$a0"], localvars: [] } },
      body: "addi a0,a0,7", source: "uint64_t fRef(uint64_t x) { return x+7; }", referenceSymbol: "fRef",
      verify: [{ name: "wrap", declarations: "uint64_t input=UINT64_MAX, result=0;", reference: "result=fRef(input);", before: "ld a0,input", after: "la t6,result\nsd a0,0(t6)", observe: [{ name: "result", type: "uint64_t" }] }]
    };
    const args = fixture(model);
    const command = ["rv-fcall", "exercises", args[0], "-o", args[1], "--manifest", args[2]];
    success(command);
    const intermediate = fs.readFileSync(args[1], "utf8");
    assert.match(intermediate, /^Answer 6; \$\{isa.asm\}/);
    assert.match(intermediate, /\.\.\/assets\/call\/assets\/rv-fun-complete-diagram.svg\)\{#fig-kept\}/);
    assert.match(intermediate, /%% \[edit\]\(\.\.\/instances.yml\) %%/);
    const manifest = yaml.load(fs.readFileSync(args[2], "utf8"));
    const directory = path.join(root, "assets", "call");
    fs.mkdirSync(directory, { recursive: true });
    for (const [name, value] of Object.entries(manifest.call.inputs)) fs.writeFileSync(path.join(directory, name), value);
    const artifacts = JSON.parse(success(["rv-fcall", "artifact", path.join(directory, "input.json")]));
    assert.deepStrictEqual(artifacts.latex.map(item => item.sfx), ["complete-diagram", "blank-diagram", "asm-source-full", "asm-source-empty", "blank-table", "c-source"]);
    const legacyFull = success(["rv-fcall", "asm", path.join(directory, "input.json")]);
    assert.strictEqual(legacyFull, manifest.call.inputs["full.s"] + "\n");
    fs.writeFileSync(path.join(root, "isa.yml"), yaml.dump({ mode: "inline", chapter: "generated/fcall.md", tag: "isa", sections: [{ title: "ISA", exercises: [{ id: "isa", generate: { kind: "fragment", reason: "Isolated instruction", fragments: { asm: "nop" } } }] }] }));
    const final = path.join(root, "final.md");
    success(["isa", "exercises", path.join(root, "isa.yml"), "-o", final, "--manifest", path.join(root, "isa-assets.yml")]);
    assert.match(fs.readFileSync(final, "utf8"), /^Answer 6; nop\n!\[stack\]\(assets\/call\/assets\/rv-fun-complete-diagram.svg\)\{#fig-kept\}/);
    const publishedManifest = fs.readFileSync(args[2], "utf8");
    model.body = "addi a0,a0,8";
    fixture(model);
    const failure = run(command);
    assert.notStrictEqual(failure.status, 0);
    assert.match(failure.stderr + failure.stdout, /native C\/assembly mismatch/);
    assert.strictEqual(fs.readFileSync(args[1], "utf8"), intermediate);
    assert.strictEqual(fs.readFileSync(args[2], "utf8"), publishedManifest);
  });
});
