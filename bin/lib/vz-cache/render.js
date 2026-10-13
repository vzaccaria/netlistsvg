"use strict";

let _ = require("lodash");
let numeral = require("numeral");
let { latexArtifact } = require("../artifacts");
let { lab } = require("../common");
let { getMemSize } = require("./config");

let asTableLine = a => _.join(a, " & ") + "\\\\";

let cacheKind = config => {
  if (config.cacheways === 0) return "diretto";
  return `${Math.pow(2, config.cacheways)} vie`;
};

let produceCacheBadge = config => `
\\begin{itemize}
\\setlength\\itemsep{-.5em}
\\item Indirizzamento cache: ${cacheKind(config)}
\\item Dimensioni memoria di lavoro: ${numeral(Math.pow(2, config.membits)).format("0 ib")}
\\item Dimensioni cache: ${numeral(Math.pow(2, config.cachesizebits)).format("0 ib")}
\\item Dimensioni blocco cache: ${numeral(Math.pow(2, config.blockbits)).format("0 ib")}
\\end{itemize}`;

let produceCacheData = (config, blank) => {
  let { membits, blockindexbits, tagbits, blockbits } = getMemSize(config);
  let show = x => (!blank ? x : "\\ldots");
  return `
\\begin{itemize}
\\setlength\\itemsep{-.5em}
\\item dimensione di indirizzo (bits): ${show(membits)}
\\item dimensione byte offset nel blocco (bits): ${show(blockbits)}
\\item dimensione indice del blocco o insieme nella cache (bits): ${show(blockindexbits)}
\\item dimensione del tag (bits): ${show(tagbits)}
\\end{itemize}
`;
};

let getCacheBlock = _.curry((i, { valid, tag, data, highlight }) => {
  if (highlight || i === 0) {
    return [
      valid ? "$\\checkmark$" : "$\\times$",
      valid ? (tag ? `\\texttt{${tag}}` : "") : "inval.",
      !_.isUndefined(data) ? data : ""
    ];
  }
  return _.map(
    [
      valid ? "$\\checkmark$" : "$\\times$",
      tag ? `\\texttt{${tag}}` : "",
      !_.isUndefined(data) ? data : ""
    ],
    value => `{\\color{lightgray}${value}}`
  );
});

let encodeAddr = (config, address) => {
  if (config.blank) return address;
  let bits = _.join(_.filter(address, c => c !== " "), "");
  let { membits, blockindexbits, tagbits } = getMemSize(config);
  if (_.size(bits) !== membits) {
    throw `Address bits of ${bits} must be exactly ${membits}`;
  }
  let tag = bits.slice(0, tagbits);
  let bindex = bits.slice(tagbits, tagbits + blockindexbits);
  let boffset = bits.slice(tagbits + blockindexbits, membits);
  return `{\\color{olive} ${tag}} {\\color{teal} ${bindex}} {\\color{gray} ${boffset}} `;
};

let produceLine = _.curry((config, t, i) => {
  let acc = t.access ? `\\texttt{${_.trim(encodeAddr(config, t.access))}}` : "";
  let ttype = t.type ? (t.type === "hit" ? "\\textsc{H}" : "\\textsc{M}") : "";
  let cells = _.map(t.state, getCacheBlock(i));
  let desc = t.description || "";
  if (!config.blank || i === 0) {
    return asTableLine(_.flattenDeep([i, acc, ttype, cells, desc]));
  }
  let ph = s => (s ? `\\phantom{${s}}` : "");
  return asTableLine(
    _.flattenDeep([
      i,
      acc,
      ph(ttype),
      _.map(cells, row => _.map(row, ph)),
      ph(desc)
    ])
  );
});

let encodeBlockIndex = _.curry((config, i) => {
  if (config.cacheways === 0) return i;
  let bsize = Math.pow(2, config.cacheways);
  let setNum = Math.floor(i / bsize);
  let blockNum = i % bsize;
  return `${setNum}.${lab("", blockNum)}`;
});

let nblocks = config => getMemSize(config).numberOfBlocks;

let l0 = config =>
  _.flattenDeep([
    "",
    "",
    "",
    _.map(
      _.range(0, nblocks(config)),
      i => `\\multicolumn{3}{c|}{Block ${encodeBlockIndex(config, i)}}`
    ),
    ""
  ]);

let l1 = config =>
  _.flattenDeep([
    "",
    "address",
    "result",
    _.map(_.range(0, nblocks(config)), () => ["V", "T", "M"]),
    "action"
  ]);

let tableWrap = _.curry((n, data, config) => {
  let hd = _.join(_.fill(Array(n), "c"), "|");
  return `
  \\begin{tabular}{|${hd}|}
  ${asTableLine(l0(config))}
  ${asTableLine(l1(config))}
  \\hline
  ${data}
  \\end{tabular}`;
});

let getCols = config => {
  let { numberOfBlocks } = getMemSize(config);
  return 2 + 3 * numberOfBlocks + 2;
};

let getCompleteTrace = (trace, config) =>
  tableWrap(
    getCols(config),
    _.join(_.map(trace.results.actions, produceLine(config)), "\n\\hline"),
    config
  );

let produceCombinedSheet = (config, trace, blank) => {
  let cfg = _.merge({}, config, { blank });
  return `${produceCacheData(cfg, blank)}

\\vspace{0.5em}

${getCompleteTrace(trace, cfg)}
`;
};

let produceSimulationArtifacts = sim => {
  return {
    simulation: sim,
    latex: [
      latexArtifact(
        produceCacheBadge(sim.config),
        "badge",
        "standalone",
        "pdflatex",
        "-r varwidth=10cm"
      ),
      latexArtifact(
        produceCacheData(sim.config, false),
        "Cache data",
        "standalone",
        "pdflatex",
        "-r varwidth=10cm"
      ),
      latexArtifact(
        produceCacheData(sim.config, true),
        "Cache data blank",
        "standalone",
        "pdflatex",
        "-r varwidth=10cm"
      ),
      latexArtifact(
        getCompleteTrace(sim, _.merge({}, sim.config, { blank: false })),
        "Complete trace",
        "standalone",
        "pdflatex",
        "-r varwidth=20cm --usepackage amssymb,xcolor",
        ["amssymb", "xcolor"]
      ),
      latexArtifact(
        getCompleteTrace(sim, _.merge({}, sim.config, { blank: true })),
        "Blank trace",
        "standalone",
        "pdflatex",
        "-r varwidth=20cm --usepackage amssymb",
        ["amssymb", "xcolor"]
      ),
      latexArtifact(
        produceCombinedSheet(sim.config, sim, true),
        "Combined blank",
        "standalone",
        "pdflatex",
        "-r varwidth=20cm --usepackage amssymb,xcolor",
        ["amssymb", "xcolor"]
      ),
      latexArtifact(
        produceCombinedSheet(sim.config, sim, false),
        "Combined complete",
        "standalone",
        "pdflatex",
        "-r varwidth=20cm --usepackage amssymb,xcolor",
        ["amssymb", "xcolor"]
      )
    ]
  };
};

module.exports = {
  getCompleteTrace,
  produceCacheBadge,
  produceCacheData,
  produceSimulationArtifacts
};
