#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const { execWithStringStdErr } = require("./lib/common.js");
let $gstd = require("get-stdin");
const _ = require("lodash");
const { beautifyProg, run } = require("./lib/spim");

let $fs = require("mz/fs");

let defaultConfig = {
  membits: 14,
  cacheways: 0, // 0=direct or n=2^n-way
  blockbits: 9,
  cachesizebits: 11
};

let getMemSize = ({ membits, cacheways, blockbits, cachesizebits }) => {
  let blockindexbits = cachesizebits - blockbits - cacheways;
  return {
    tagbits: membits - blockindexbits - blockbits,
    blockbits,
    membits,
    blockindexbits
  };
};

// ◀───wkbnumber───▶
// ┌───────┬────────┬────────────────┐
// │  tag  │ bindex │    boffset     │
// └───────┴────────┴────────────────┘

let daddr = (config, numeric) => {
  let bits = _.join(_.filter(numeric, c => c !== " "), "");
  let { membits, blockindexbits, tagbits } = getMemSize(config);
  _.padStart(bits, membits, "0");
  let tag = bits.slice(0, tagbits);
  let bindex = bits.slice(tagbits, tagbits + blockindexbits);
  let wkbnumber = bits.slice(0, tagbits + blockindexbits);
  let boffset = bits.slice(tagbits + blockindexbits, membits);
  let desc = `Blocco mem[${parseInt(wkbnumber, 2)}] in cache[${parseInt(
    bindex,
    2
  )}]`;
  return { tag, bindex, boffset, wkbnumber, desc };
};

let main = () => {
  prog
    .description("Cache utils")
    .command("decode")
    .argument("<num>", `<num> is a binary string`)
    .option("-m, --membits <num>", "main address size", prog.INT, 14)
    .option("-w, --cacheways <num>", "log2 of cache ways", prog.INT, 0)
    .option("-b, --blockbits <num>", "log2 of block size ", prog.INT, 9)
    .option(
      "-s, --cachesizebits <num>",
      "log2 of cache size (bits)",
      prog.INT,
      11
    )
    .action(async (args, options) => {
      console.log(daddr(options, args.num));
    });
  prog.parse(process.argv);
};

main();
