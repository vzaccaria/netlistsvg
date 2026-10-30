"use strict";
/* global describe, it */

const assert = require("assert");
const { generateModel, executeCase } = require("./model");

describe("ISA collection model", function () {
  it("keeps nested source variations exact without rounding 64-bit literals", function () {
    const model = generateModel({ kind: "fragment", reason: "A deliberately incomplete address-loading stage", parameters: { address: "18446744073709551615" }, fragments: { immediate: "${address}", asm: "li a0,${immediate}" } });
    assert.strictEqual(model.values.asm, "li a0,18446744073709551615");
    assert.strictEqual(model.evidence.kind, "fragment");
    assert.match(model.values.verification, /not executable/);
  });

  it("rejects rounded parameters, cycles and false fragment verification claims", function () {
    assert.throws(() => generateModel({ kind: "fragment", reason: "stage", parameters: { x: 2 ** 63 } }), /quote exact 64-bit/);
    assert.throws(() => generateModel({ kind: "fragment", reason: "stage", fragments: { a: "${b}", b: "${a}" } }), /cyclic fragment/);
    assert.throws(() => generateModel({ kind: "fragment", reason: "stage", verify: [] }), /cannot claim/);
    assert.throws(() => generateModel({ kind: "program", fragments: {} }), /requires nonempty/);
  });
});

const nativeDescribe = process.env.VZPAC_NATIVE_TESTS === "1" ? describe : describe.skip;
nativeDescribe("ISA native GCC/QEMU behavior", function () {
  this.timeout(180000);

  it("detects the historical signed branch error on a uint64_t high-bit input", function () {
    const spec = { name: "unsigned-high-bit", declarations: "uint64_t a=UINT64_C(9223372036854775808), v=0;", before: "ld a0,a", after: "la t6,v\nsd a1,0(t6)", observe: [{ name: "v", type: "uint64_t" }], reference: "v = a > 0 ? 11 : 22;", asm: "blez a0,.Lzero\nli a1,11\nj .Ldone\n.Lzero:\nli a1,22\n.Ldone:" };
    assert.throws(() => executeCase(spec), /native C\/assembly mismatch/);
    const actual = executeCase(Object.assign({}, spec, { asm: spec.asm.replace("blez", "beqz") }));
    assert.strictEqual(actual.state.v, "11");
  });

  it("captures signed word results and exact unsigned arrays as executed", function () {
    const model = generateModel({ kind: "program", fragments: { asm: "li t0,-3\nla t1,x\nsw t0,0(t1)\nla t1,v\nli t0,-1\nsd t0,0(t1)" }, verify: [{ name: "widths", declarations: "int32_t x=0; uint64_t v[2]={0, UINT64_C(9223372036854775808)};", asm: "${asm}", reference: "x=-3; v[0]=UINT64_MAX;", observe: [{ name: "x", type: "int32_t" }, { name: "v", type: "uint64_t", length: 2 }] }] });
    assert.strictEqual(model.values.value_x, "-3");
    assert.strictEqual(model.values.value_v, "18446744073709551615, 9223372036854775808");
  });

  it("preserves the caller ABI while binding locals and calling a distinct helper f", function () {
    const result = executeCase({ name: "helper-and-bindings", declarations: "int64_t x=-5, result=0; uint64_t calls=0;", helpers: "int64_t f(int64_t x) { ++calls; return x*3; }", before: "ld a0,x", asm: "f:\nli s0,123\nli s11,456\ncall f\naddi a0,a0,2\nret", after: "la t6,result\nsd a0,0(t6)", reference: "result=f(x)+2;", observe: [{ name: "result", type: "int64_t" }, { name: "calls", type: "uint64_t" }] });
    assert.deepStrictEqual(Object.assign({}, result.state), { result: "-13", calls: "1" });
  });

  it("does not execute inline strings and compares application stdout exactly", function () {
    const spec = { name: "literal-stdout", asm: '.LC0:\n.string "hello"\nla a0,.LC0\ncall puts', reference: 'puts("hello");', stdout: true };
    assert.strictEqual(executeCase(spec).stdout, "hello\n");
    assert.throws(() => executeCase(Object.assign({}, spec, { reference: 'printf("hello");' })), /native C\/assembly mismatch/);
  });

  it("supports complete assembly main without colliding with the C harness", function () {
    const result = executeCase({ name: "full-main", asmSource: '.section .rodata\n.Lmessage:\n.string "native main"\n.text\n.globl main\nmain:\naddi sp,sp,-16\nsd ra,8(sp)\nla a0,.Lmessage\ncall puts\nld ra,8(sp)\naddi sp,sp,16\nret', reference: 'puts("native main");', stdout: true });
    assert.strictEqual(result.stdout, "native main\n");
  });

  it("rejects falsely declared observation widths instead of silently truncating", function () {
    assert.throws(() => executeCase({ name: "wrong-width", declarations: "uint64_t x=1;", asm: "nop", reference: "x=1;", observe: [{ name: "x", type: "uint32_t" }] }), /observation type mismatch/);
  });

  it("reports nontermination explicitly instead of producing a fallback answer", function () {
    assert.throws(() => executeCase({ name: "infinite", declarations: "uint64_t x=0;", asm: ".Lforever:\nj .Lforever", reference: "x=0;", observe: [{ name: "x", type: "uint64_t" }], timeout: 0.2 }), /timeout/);
  });
});
