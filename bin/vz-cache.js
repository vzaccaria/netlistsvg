#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const { execWithStringStdErr } = require("./lib/common.js");
let $gstd = require("get-stdin");
const _ = require("lodash");
const { beautifyProg, run } = require("./lib/spim");

let { latexArtifact, saveArtifacts } = require("./lib/artifacts");

// check

let $fs = require("mz/fs");

/* Each block might have the following data: 
   - valid: bool,
   - data: integer,
   - tag: integer,
   - last: integer (last access time)
*/

let asTableLine = a => {
  return _.join(a, " & ") + "\\\\";
};

let getCacheBlock = ({ valid, tag, data }) => {
  return [valid ? "$\\checkmark$" : "$\\times$", `\\texttt{${tag}}`, data];
};

let produceLine = _.curry((opts, t, i) => {
  let acc = t.access ? `\\texttt{${_.trim(t.access)}}` : "";
  let ttype = t.type ? (t.type === "hit" ? "\\textsc{H}" : "\\textsc{M}") : "";
  if (!opts.blank || i === 0) {
    return asTableLine(
      _.flattenDeep([
        i,
        acc,
        ttype,
        _.map(t.state, getCacheBlock),
        t.description
      ])
    );
  } else {
    return asTableLine(
      _.flattenDeep([i, acc, "", _.map(t.state, () => ["", "", ""]), ""])
    );
  }
});

let l0 = [
  "",
  "",
  "",
  "\\multicolumn{3}{c|}{Block 0}",
  "\\multicolumn{3}{c|}{Block 1}",
  "\\multicolumn{3}{c|}{Block 2}",
  "\\multicolumn{3}{c|}{Block 3}",
  ""
];

let l1 = [
  "",
  "address",
  "result",
  "V",
  "T",
  "M",
  "V",
  "T",
  "M",
  "V",
  "T",
  "M",
  "V",
  "T",
  "M",
  "action"
];

let tableWrap = _.curry((n, data) => {
  let hd = _.join(_.fill(Array(n), "c"), "|");
  return `
\\begin{table}
 \\footnotesize
  \\begin{tabular}{|${hd}|}
  ${asTableLine(l0)} 
  ${asTableLine(l1)} 
  \\hline
  ${data}
  \\end{tabular}
\\end{table}`;
});

let getCompleteTrace = (t, opts) =>
  tableWrap(
    16,
    _.join(_.map(t.results.actions, produceLine(opts)), "\n\\hline")
  );

let produceAndSaveArtifacts = async (args, options, trace) => {
  let result = {
    latex: [
      latexArtifact(
        getCompleteTrace(trace, { blank: false }),
        "Complete trace",
        "standalone",
        "pdflatex",
        "-r varwidth=20cm --usepackage amssymb"
      ),
      latexArtifact(
        getCompleteTrace(trace, { blank: true }),
        "Blank trace",
        "standalone",
        "pdflatex",
        "-r varwidth=20cm --usepackage amssymb"
      )
    ]
  };
  if (options.save) {
    return saveArtifacts(result, options.save);
  } else {
    console.log(JSON.stringify(result));
  }
};

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
  let iwkbnumber = parseInt(wkbnumber, 2);
  let ibindex = parseInt(bindex, 2);
  let desc = `mem[${iwkbnumber}] in cache[${ibindex}]`;
  return { tag, bindex, boffset, wkbnumber, desc, ibindex, iwkbnumber };
};

let emptyCache = [
  { valid: false },
  { valid: false },
  { valid: false },
  { valid: false }
];

let nextCache = _.curry((config, { cache, actions }, access) => {
  cache = _.cloneDeep(cache);
  actions = _.cloneDeep(actions);
  let { tag, ibindex, iwkbnumber, desc } = daddr(config, access);
  if (config.cacheways === 0) {
    if (
      !cache[ibindex].valid ||
      (cache[ibindex].valid && cache[ibindex].tag !== tag)
    ) {
      cache[ibindex].valid = true;
      cache[ibindex].tag = tag;
      cache[ibindex].data = iwkbnumber;
      actions.push({
        type: "miss",
        state: cache,
        description: `carico ${desc}`,
        access
      });
    } else {
      actions.push({
        type: "hit",
        state: cache,
        description: `leggo ${desc}`,
        access
      });
    }
  } else {
    /* multiway tbd */
  }
  return { cache, actions };
});

let simulate = (config, emptyc, accesslist) => {
  accesslist = accesslist.split(",");
  return {
    accesslist,
    results: _.reduce(accesslist, nextCache(config), {
      cache: emptyc,
      actions: [{ type: "", state: emptyc, description: "Situazione iniziale" }]
    })
  };
};

let getEmptyConfig = s => {
  s = s.split(",");
  s = _.chunk(s, 3);
  let e = _.map(s, ([v, e, d]) => {
    return {
      valid: parseInt(v),
      tag: e,
      data: parseInt(d)
    };
  });
  return e;
};

let main = () => {
  prog
    .description("Cache utils")
    .command("sim")
    .argument("<alist>", `comma sep. list of binary numbers (addresses)`)
    .option("-m, --membits <num>", "main address size", prog.INT, 14)
    .option("-w, --cacheways <num>", "log2 of cache ways", prog.INT, 0)
    .option("-b, --blockbits <num>", "log2 of block size ", prog.INT, 9)
    .option(
      "-s, --cachesizebits <num>",
      "log2 of cache size (bits)",
      prog.INT,
      11
    )
    .option(
      "-e, --empty <string>",
      "sequence of triplets for initializing cache"
    )
    .action(async (args, options) => {
      let e = emptyCache;
      if (options.empty) {
        e = getEmptyConfig(options.empty);
      }
      produceAndSaveArtifacts(args, options, simulate(options, e, args.alist));
    });
  prog.parse(process.argv);
};

main();
