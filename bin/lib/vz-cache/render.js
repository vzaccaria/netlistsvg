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
  if (!config.blank || i === 0) {
    return asTableLine(
      _.flattenDeep([
        i,
        acc,
        ttype,
        _.map(t.state, getCacheBlock(i)),
        t.description
      ])
    );
  }
  return asTableLine(
    _.flattenDeep([i, acc, "", _.map(t.state, () => ["", "", ""]), ""])
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

let emptyCacheState = config =>
  _.map(_.range(0, config.numberOfBlocks), () => ({ valid: false }));

let flattenState = (config, sets, highlightBlock) => {
  return _.flatten(
    _.map(_.range(0, config.numberOfSets), setIndex =>
      _.map(_.range(0, config.associativity), way => {
        let line = sets[setIndex][way];
        if (_.isUndefined(line)) return { valid: false };
        return {
          valid: true,
          tag: line.tagBits,
          data: line.blockNumber,
          highlight: line.blockNumber === highlightBlock
        };
      })
    )
  );
};

let applyTraceAccess = (config, sets, row, step) => {
  let set = sets[row.set];
  let line = _.find(set, l => l.tag === row.tag);
  if (!_.isUndefined(line)) {
    line.last = step;
    return;
  }

  let newLine = {
    tag: row.tag,
    tagBits: row.tagBits,
    blockNumber: row.blockNumber,
    last: step
  };
  if (set.length < config.associativity) {
    set.push(newLine);
  } else {
    let victim = _.minBy(set, l => l.last);
    let victimIndex = _.findIndex(set, l => l === victim);
    set[victimIndex] = newLine;
  }
};

let actionDescription = (config, row) => {
  let verb = row.expected === "hit" ? "leggo" : "carico";
  if (config.blockindexbits === 0) return `${verb} mem[${row.blockNumber}] in cache`;
  return `${verb} mem[${row.blockNumber}] in cache[${row.set}]`;
};

let legacyTraceFromSimulation = sim => {
  let config = sim.config;
  let sets = _.map(_.range(0, config.numberOfSets), () => []);
  let actions = [
    {
      type: "",
      state: emptyCacheState(config),
      description: "Situazione iniziale"
    }
  ];

  _.forEach(sim.trace, row => {
    applyTraceAccess(config, sets, row, row.step);
    actions.push({
      type: row.expected,
      state: flattenState(config, sets, row.blockNumber),
      description: actionDescription(config, row),
      access: row.groupedAddress
    });
  });

  return {
    accesslist: _.map(sim.trace, row => row.groupedAddress),
    results: { actions }
  };
};

let produceSimulationArtifacts = sim => {
  let trace = legacyTraceFromSimulation(sim);
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
        getCompleteTrace(trace, _.merge({}, sim.config, { blank: false })),
        "Complete trace",
        "standalone",
        "pdflatex",
        "-r varwidth=20cm --usepackage amssymb,xcolor",
        ["amssymb", "xcolor"]
      ),
      latexArtifact(
        getCompleteTrace(trace, _.merge({}, sim.config, { blank: true })),
        "Blank trace",
        "standalone",
        "pdflatex",
        "-r varwidth=20cm --usepackage amssymb",
        ["amssymb", "xcolor"]
      )
    ]
  };
};

module.exports = {
  getCompleteTrace,
  legacyTraceFromSimulation,
  produceCacheBadge,
  produceCacheData,
  produceSimulationArtifacts
};
