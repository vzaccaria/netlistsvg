"use strict";
/* global describe, it */

const assert = require("assert");
const { render } = require("../../vz-rv-fcall");
const { generateModel } = require("./model");

function leaf(body = "addi a0,a0,7", source = "uint64_t fRef(uint64_t x) { return x+7; }") {
  return {
    layout: { stackgrows: "down", omitFramePointer: true, functionData: { name: "f", isLeaf: true, parameters: ["x/$a0"], localvars: [] } },
    body, source, referenceSymbol: "fRef",
    verify: [{ name: "wrap", declarations: "uint64_t input=UINT64_MAX, result=0;", reference: "result=fRef(input);", before: "ld a0,input", after: "la t6,result\nsd a0,0(t6)", observe: [{ name: "result", type: "uint64_t" }] }]
  };
}

describe("rv-fcall native renderer contract", function () {
  it("keeps caller aggregate chunks outside the callee's eight-byte frame", function () {
    const layout = { stackgrows: "down", omitFramePointer: true, functionData: { name: "f", isLeaf: true, parameters: ["s/20b"], localvars: ["c/w"] } };
    const result = render(layout, "lbu t0,0(a0)\nsd t0,0(sp)\nld a0,0(sp)", "char fRef(void);");
    assert.strictEqual(result.stackAlloc, 8);
    assert.deepStrictEqual(result.state.filter(cell => cell.type === "parameter").map(cell => [cell.name, cell.offset]), [
      ["s[19..16]", 24], ["s[15..8]", 16], ["s[7..0]", 8]
    ]);
    assert.deepStrictEqual(result.state.filter(cell => cell.type === "localvar").map(cell => [cell.name, cell.offset]), [["c", 0]]);
  });

  it("retains the frame-pointer slot, saved return address and reverse local ordering", function () {
    const result = render({ stackgrows: "down", omitFramePointer: false, functionData: { name: "f", isLeaf: false, parameters: [], localvars: ["x/$s1", "v/9b"] } }, "", "void f(void);");
    assert.strictEqual(result.stackAlloc, 40);
    assert.deepStrictEqual(result.state.filter(cell => cell.type !== "zone").map(cell => [cell.name, cell.offset]), [
      ["fp", 32], ["ra", 24], ["s1", 16], ["v[8..8]", 8], ["v[7..0]", 0]
    ]);
  });

  it("rejects a competing full listing or verification subject before native execution", function () {
    assert.throws(() => generateModel(Object.assign(leaf(), { full: "ret" })), /full assembly is generated/);
    const model = leaf();
    model.verify[0].asmSource = "f:\nret";
    assert.throws(() => generateModel(model), /verify.asmSource is generated/);
    delete model.verify[0].asmSource;
    model.layout.functionData.body = "old-body.s";
    assert.throws(() => generateModel(model), /provide inline body\/source/);
  });

  it("requires explicit reference identity and nonempty uniquely named cases", function () {
    assert.throws(() => generateModel(Object.assign(leaf(), { referenceSymbol: "absent" })), /not present/);
    assert.throws(() => generateModel(Object.assign(leaf(), { verify: [] })), /nonempty native/);
    const model = leaf();
    model.verify.push(Object.assign({}, model.verify[0]));
    assert.throws(() => generateModel(model), /duplicate verify/);
  });
});

const nativeDescribe = process.env.VZPAC_NATIVE_TESTS === "1" ? describe : describe.skip;
nativeDescribe("rv-fcall native GCC/QEMU behavior", function () {
  this.timeout(180000);

  it("observes exact uint64 boundaries and changes results only when C and body agree", function () {
    const model = leaf();
    model.verify.push(Object.assign({}, model.verify[0], { name: "high-bit", declarations: "uint64_t input=UINT64_C(9223372036854775808), result=0;" }));
    const first = generateModel(model);
    assert.strictEqual(first.values.value_wrap_result, "6");
    assert.strictEqual(first.values["value_high-bit_result"], "9223372036854775815");
    model.body = "addi a0,a0,8";
    assert.throws(() => generateModel(model), /native C\/assembly mismatch/);
    model.source = "uint64_t fRef(uint64_t x) { return x+8; }";
    assert.strictEqual(generateModel(model).values.value_wrap_result, "7");
  });

  it("executes the generated recursive entry without resolving recursive calls to C", function () {
    const model = leaf();
    model.layout.functionData.isLeaf = false;
    model.layout.functionData.localvars = ["n/$s0"];
    model.referenceSymbol = "f";
    model.source = "uint64_t f(uint64_t n) { return n<1 ? 1 : n*f(n-1); }";
    model.body = "mv s0,a0\nli t0,1\nbgeu s0,t0,recurse\nli a0,1\nj fEPI\nrecurse:\naddi a0,s0,-1\ncall f\nmul a0,a0,s0";
    model.verify = [0, 1, 6, 65, 66].map(n => ({ name: `n${n}`, declarations: `uint64_t input=${n}, result=0;`, reference: "result=f(input);", before: "ld a0,input", after: "la t6,result\nsd a0,0(t6)", observe: [{ name: "result", type: "uint64_t" }] }));
    const result = generateModel(model);
    assert.deepStrictEqual(result.cases.map(item => item.state.result), ["1", "1", "720", "9223372036854775808", "0"]);
    model.body = model.body.replace("mul a0,a0,s0", "add a0,a0,s0");
    assert.throws(() => generateModel(model), /native C\/assembly mismatch/);
  });

  it("compares fixture helper call order as typed state even when returns match", function () {
    const model = leaf();
    model.layout.functionData.isLeaf = false;
    model.source = "uint64_t fRef(uint64_t x) { helper(x); return helper(x+1); }";
    model.body = "li a0,4\ncall helper\nli a0,5\ncall helper";
    model.verify = [{ name: "trace", declarations: "uint64_t result=0, count=0, trace[2]={0,0};", helpers: "uint64_t helper(uint64_t x) { if (count>=2) abort(); trace[count++]=x; return 7; }", reference: "result=fRef(4);", after: "la t6,result\nsd a0,0(t6)", observe: [{ name: "result", type: "uint64_t" }, { name: "count", type: "uint64_t" }, { name: "trace", type: "uint64_t", length: 2 }] }];
    const result = generateModel(model);
    assert.strictEqual(result.values.value_trace, "4, 5");
    model.body = "li a0,5\ncall helper\nli a0,4\ncall helper";
    assert.throws(() => generateModel(model), /native C\/assembly mismatch/);
  });

  it("preserves literal output spaces and detects stdout-only mismatches", function () {
    const model = leaf();
    model.layout.functionData.isLeaf = false;
    model.layout.functionData.strings = { message: "18 21 23 19 " };
    model.source = 'void fRef(void) { printf("18 21 23 19 "); }';
    model.body = "la a0,message\ncall printf";
    model.verify = [{ name: "spaces", reference: "fRef();", stdout: true }];
    assert.strictEqual(generateModel(model).values.stdout, "18 21 23 19 ");
    model.layout.functionData.strings.message = "18212319";
    assert.throws(() => generateModel(model), /native C\/assembly mismatch/);
  });
});
