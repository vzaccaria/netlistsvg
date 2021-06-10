#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const _ = require("lodash");

let { latexArtifact, saveArtifacts } = require("./lib/artifacts");
let { lab } = require("./lib/common");

// check

/* Each block might have the following data: 
   - valid: bool,
   - data: integer,
   - tag: integer,
   - last: integer (last access time)
*/

let asTableLine = a => {
  return _.join(a, " & ") + "\\\\";
};

let getCacheBlock = _.curry((i, { valid, tag, data, highlight }) => {
  if (highlight || i === 0) {
    return [
      valid ? "$\\checkmark$" : "$\\times$",
      tag ? `\\texttt{${tag}}` : "",
      !_.isUndefined(data) ? data : ""
    ];
  } else {
    return _.map(
      [
        valid ? "$\\checkmark$" : "$\\times$",
        tag ? `\\texttt{${tag}}` : "",
        !_.isUndefined(data) ? data : ""
      ],
      i => `{\\color{lightgray}${i}}`
    );
  }
});

let encodeAddr = (opts, a) => {
  if (opts.blank) return a;
  else {
    let { tag, bindex, boffset } = daddr(opts, a);
    return `{\\color{olive} ${tag}} {\\color{teal} ${bindex}} {\\color{gray} ${boffset}} `;
  }
};

const numeral = require("numeral");

let produceCacheData = (opts, blank) => {
  let { membits, blockindexbits, tagbits, blockbits } = getMemSize(opts);
  let _g = x => (!blank ? x : "\\ldots");
  let b = `
\\begin{itemize}
\\setlength\\itemsep{-.5em}
\\item dimensione di indirizzo (bits): ${_g(membits)}
\\item dimensione byte offset nel blocco (bits): ${_g(blockbits)}
\\item dimensione indice del blocco o insieme nella cache (bits): ${_g(
    blockindexbits
  )}
\\item dimensione del tag (bits): ${_g(tagbits)}
\\end{itemize}
`;
  return b;
};

let produceCacheBadge = opts => {
  let b = `
\\begin{itemize}
\\setlength\\itemsep{-.5em}
\\item Indirizzamento cache: ${
    opts.cacheways === 0 ? "diretto" : Math.pow(2, opts.cacheways) + " vie"
  }
\\item Dimensioni memoria di lavoro: ${numeral(
    Math.pow(2, opts.membits)
  ).format("0 ib")}
\\item Dimensioni cache: ${numeral(Math.pow(2, opts.cachesizebits)).format(
    "0 ib"
  )}
\\item Dimensioni blocco cache: ${numeral(Math.pow(2, opts.blockbits)).format(
    "0 ib"
  )}
\\end{itemize}`;
  return b;
};

let produceLine = _.curry((opts, t, i) => {
  let acc = t.access ? `\\texttt{${_.trim(encodeAddr(opts, t.access))}}` : "";
  let ttype = t.type ? (t.type === "hit" ? "\\textsc{H}" : "\\textsc{M}") : "";
  if (!opts.blank || i === 0) {
    return asTableLine(
      _.flattenDeep([
        i,
        acc,
        ttype,
        _.map(t.state, getCacheBlock(i)),
        t.description
      ])
    );
  } else {
    return asTableLine(
      _.flattenDeep([i, acc, "", _.map(t.state, () => ["", "", ""]), ""])
    );
  }
});

let nblocks = opts => getMemSize(opts).numberOfBlocks;

let encodeBlockIndex = _.curry((opts, i) => {
  if (opts.cacheways === 0) return i;
  else {
    let bsize = Math.pow(2, opts.cacheways);
    let setNum = Math.floor(i / bsize);
    let blockNum = i % bsize;
    return `${setNum}.${lab("", blockNum)}`;
  }
});

let replArray = (n, f) => _.map(_.range(0, n), f);

let l0 = opts =>
  _.flattenDeep([
    "",
    "",
    "",
    replArray(
      nblocks(opts),
      i => `\\multicolumn{3}{c|}{Block ${encodeBlockIndex(opts, i)}}`
    ),
    ""
  ]);

let l1 = opts =>
  _.flattenDeep([
    "",
    "address",
    "result",
    replArray(nblocks(opts), () => ["V", "T", "M"]),
    "action"
  ]);

let tableWrap = _.curry((n, data, opts) => {
  let hd = _.join(_.fill(Array(n), "c"), "|");
  return `
  \\begin{tabular}{|${hd}|}
  ${asTableLine(l0(opts))} 
  ${asTableLine(l1(opts))} 
  \\hline
  ${data}
  \\end{tabular}`;
});

let getCols = opts => {
  let { numberOfBlocks } = getMemSize(opts);
  return 2 + 3 * numberOfBlocks + 2;
};

let getCompleteTrace = (t, opts) =>
  tableWrap(
    getCols(opts),
    _.join(_.map(t.results.actions, produceLine(opts)), "\n\\hline"),
    opts
  );

let produceAndSaveArtifacts = async (args, options, trace) => {
  let result = {
    latex: [
      latexArtifact(
        produceCacheBadge(options),
        "badge",
        "standalone",
        "pdflatex",
        "-r varwidth=10cm"
      ),
      latexArtifact(
        produceCacheData(options, false),
        "Cache data",
        "standalone",
        "pdflatex",
        "-r varwidth=10cm"
      ),
      latexArtifact(
        produceCacheData(options, true),
        "Cache data blank",
        "standalone",
        "pdflatex",
        "-r varwidth=10cm"
      ),
      latexArtifact(
        getCompleteTrace(trace, _.merge({}, { blank: false }, options)),
        "Complete trace",
        "standalone",
        "pdflatex",
        "-r varwidth=20cm --usepackage amssymb,xcolor"
      ),
      latexArtifact(
        getCompleteTrace(trace, _.merge({}, { blank: true }, options)),
        "Blank trace",
        "standalone",
        "pdflatex",
        "-r varwidth=20cm --usepackage amssymb"
      )
    ]
  };
  if (options.save) {
    return saveArtifacts(result.latex, options.save);
  } else {
    console.log(JSON.stringify(result));
  }
};

// let defaultConfig = {
//   membits: 14,
//   cacheways: 0, // 0=direct or n=2^n-way
//   blockbits: 9,
//   cachesizebits: 11
// };

let getMemSize = ({ membits, cacheways, blockbits, cachesizebits }) => {
  let blockindexbits = cachesizebits - blockbits - cacheways;
  let tagbits = membits - blockindexbits - blockbits;
  if (blockindexbits + blockbits + tagbits !== membits)
    throw `inconsistency between data (${blockindexbits} + ${blockbits} + ${tagbits} != ${membits})`;
  return {
    tagbits: membits - blockindexbits - blockbits,
    blockbits,
    membits,
    blockindexbits,
    numberOfBlocks: Math.pow(2, blockindexbits) * Math.pow(2, cacheways)
  };
};

let checkTag = (config, tag) => {
  let { tagbits } = getMemSize(config);
  if (_.size(tag) !== tagbits) throw `tag ${tag} should have ${tagbits} bits`;
};

let checkIndex = (config, ix) => {
  let { blockindexbits } = getMemSize(config);
  if (_.size(ix) !== blockindexbits)
    throw `index ${ix} should have ${blockindexbits} bits`;
};

let checkBlockBits = (config, ix) => {
  let { blockbits } = getMemSize(config);
  if (_.size(ix) !== blockbits)
    throw `block offset ${ix} should be ${blockbits} bits`;
};

// ◀───wkbnumber───▶
// ┌───────┬────────┬────────────────┐
// │  tag  │ bindex │    boffset     │
// └───────┴────────┴────────────────┘

let daddr = (config, numeric) => {
  let bits = _.join(_.filter(numeric, c => c !== " "), "");
  let { membits, blockindexbits, tagbits } = getMemSize(config);
  if (_.size(bits) !== membits)
    throw `Address bits of ${bits} must be exactly ${membits}`;
  _.padStart(bits, membits, "0");
  let tag = bits.slice(0, tagbits);
  let bindex = bits.slice(tagbits, tagbits + blockindexbits);
  let wkbnumber = bits.slice(0, tagbits + blockindexbits);
  let boffset = bits.slice(tagbits + blockindexbits, membits);
  let iwkbnumber = parseInt(wkbnumber, 2);
  let ibindex = parseInt(bindex, 2);
  let desc;
  if (!_.isNaN(ibindex)) {
    desc = `mem[${iwkbnumber}] in cache[${ibindex}]`;
  } else {
    desc = `mem[${iwkbnumber}] in cache`;
  }
  return { tag, bindex, boffset, wkbnumber, desc, ibindex, iwkbnumber };
};

let emptyCache = opts =>
  replArray(nblocks(opts), () => {
    return {
      valid: false
    };
  });

let nextCache = _.curry((config, { cache, actions }, access, stepnum) => {
  cache = _.cloneDeep(cache);
  cache = _.map(cache, c => {
    delete c.highlight;
    return c;
  });
  actions = _.cloneDeep(actions);
  let { tag, ibindex, iwkbnumber, desc } = daddr(config, access);
  let markMiss = idx => {
    cache[idx] = {
      valid: true,
      tag,
      data: iwkbnumber,
      highlight: true,
      lastaccess: stepnum
    };
    actions.push({
      type: "miss",
      state: cache,
      description: `carico ${desc}`,
      access
    });
  };
  let markHit = idx => {
    cache[idx].highlight = true;
    cache[idx].lastaccess = stepnum;
    actions.push({
      type: "hit",
      state: cache,
      description: `leggo ${desc}`,
      access
    });
  };
  if (config.cacheways === 0) {
    if (
      !cache[ibindex].valid ||
      (cache[ibindex].valid && cache[ibindex].tag !== tag)
    )
      markMiss(ibindex);
    else markHit(ibindex);
  } else {
    /* multiway */
    let findBlockAmong = (blocks, pred) =>
      _.findIndex(cache, (c, i) => _.includes(blocks, i) && pred(i));

    let setSize = Math.pow(2, config.cacheways);
    let blocksToCheck;
    if (!_.isNaN(ibindex)) {
      blocksToCheck = _.map(_.range(0, setSize), i => i + ibindex * setSize);
    } else {
      // this is a completely set associative cache
      blocksToCheck = _.range(0, setSize);
    }
    let resHit = findBlockAmong(
      blocksToCheck,
      i => cache[i].valid && cache[i].tag === tag
    );
    if (resHit !== -1) markHit(resHit);
    else {
      /* miss */
      let notused = findBlockAmong(blocksToCheck, i => !cache[i].valid);
      if (notused !== -1) markMiss(notused);
      else {
        let annotedBlocks = _.map(blocksToCheck, i => {
          cache[i].num = i;
          if (_.isUndefined(cache[i].lastaccess)) cache[i].lastaccess = 0;
          return cache[i];
        });
        let victim = _.minBy(annotedBlocks, b => b.lastaccess).num;
        markMiss(victim);
      }
    }
  }
  return { cache, actions };
});

let randomSeq = size => _.join(_.map(_.range(size), () => _.random(1)), "");

let replaceAddress = _.curry((config, address) => {
  let { blockbits } = getMemSize(config);
  let bb = randomSeq(blockbits);
  /* notation will be '0.1' -> t0t1+randomblockbits */
  let [t0, i0, t1, i1] = config.simplesim.split(",");
  checkTag(config, t0);
  checkTag(config, t1);
  checkIndex(config, i0);
  checkIndex(config, i1);
  checkBlockBits(config, bb);
  let t = [t0, t1];
  let i = [i0, i1];
  let [tg, ix] = address.split(".");
  tg = parseInt(tg);
  ix = parseInt(ix);
  return t[tg] + i[ix] + bb;
});

let simulate = (config, emptyc, accesslist) => {
  accesslist = accesslist.split(",");
  if (!_.isUndefined(config.simplesim)) {
    accesslist = _.map(accesslist, replaceAddress(config));
  }
  return {
    accesslist,
    results: _.reduce(accesslist, nextCache(config), {
      cache: emptyc,
      actions: [{ type: "", state: emptyc, description: "Situazione iniziale" }]
    })
  };
};

let getEmptyConfig = options => {
  let s = options.empty;
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
    .option("-x, --save <prefix>", "save with prefix or dump json")
    .option("-m, --membits <num>", "main address size", prog.INT, 14)
    .option("-w, --cacheways <num>", "log2 of cache ways", prog.INT, 0)
    .option("-b, --blockbits <num>", "log2 of block size ", prog.INT, 9)
    .option("-d, --dont-simulate", "dont do any simulation")
    .option("-j, --json", "produce trace in JSON format")
    .option("--simplesim <varlist>", "varlist is t0,i0,t1,i1 list of values")
    .option("--t0 <tag>", "define tag t0 for easier simulations")
    .option("--t1 <tag>", "define tag t1 for easier simulations")
    .option("--i0 <index>", "define tag i0 for easier simulations")
    .option("--i1 <index>", "define tag i1 for easier simulations")
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
      let e = emptyCache(options);
      if (options.empty) {
        e = getEmptyConfig(options);
      }
      if (!options.json)
        produceAndSaveArtifacts(
          args,
          options,
          options.dontSimulate
            ? { results: [] }
            : simulate(options, e, args.alist)
        );
      else console.log(JSON.stringify(simulate(options, e, args.alist), 0, 4));
    });
  prog.parse(process.argv);
};

main();
