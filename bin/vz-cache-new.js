#!/usr/bin/env node
"use strict";

let numeral = require("numeral");

let {
  latexArtifact,
  writeArtifacts,
  addCompileOptions
} = require("./lib/artifacts");
let { generateConfig } = require("./lib/vz-cache/config");
let { generateSimulation } = require("./lib/vz-cache/sim");
let {
  produceSimulationArtifacts
} = require("./lib/vz-cache/render");

const SUBNAME = "cache-new";

let cacheKind = config => {
  if (config.cacheways === 0) return "diretta";
  return `${config.associativity} vie`;
};

let bytes = value => numeral(value).format("0 ib");

let exerciseLatex = config => `
\\begin{itemize}
\\setlength\\itemsep{-.5em}
\\item Dimensione della memoria di lavoro: ${bytes(config.memoryBytes)}
\\item Dimensione della cache: ${bytes(config.cacheBytes)}
\\item Dimensione del blocco: ${bytes(config.blockBytes)}
\\item Organizzazione: ${cacheKind(config)}
\\end{itemize}

Determinare:
\\begin{itemize}
\\setlength\\itemsep{-.5em}
\\item il numero di bit di offset nel blocco;
\\item il numero di bit di indice del blocco o insieme in cache;
\\item il numero di bit di tag;
\\item il numero totale di blocchi e, se applicabile, di insiemi.
\\end{itemize}
`;

let solutionLatex = config => `
\\begin{tabular}{ll}
Bit indirizzo & ${config.membits}\\\\
Bit offset nel blocco & ${config.blockbits}\\\\
Bit indice cache & ${config.blockindexbits}\\\\
Bit tag & ${config.tagbits}\\\\
Bit dimensione cache & ${config.cachesizebits}\\\\
Blocchi totali & ${config.numberOfBlocks}\\\\
Insiemi & ${config.numberOfSets}\\\\
Vie & ${config.associativity}
\\end{tabular}

\\[
${config.tagbits} + ${config.blockindexbits} + ${config.blockbits}
= ${config.membits}
\\]

\\[
2^{${config.cachesizebits}} =
2^{${config.blockbits}} \\cdot
2^{${config.blockindexbits}} \\cdot
2^{${config.cacheways}}
\\]
`;

let produceArtifacts = config => {
  return {
    config,
    latex: [
      latexArtifact(
        exerciseLatex(config),
        "Cache configuration exercise",
        "standalone",
        "pdflatex",
        "-r varwidth=12cm"
      ),
      latexArtifact(
        solutionLatex(config),
        "Cache configuration solution",
        "standalone",
        "pdflatex",
        "-r varwidth=12cm"
      )
    ]
  };
};

let register = prog => {
  let cmd = prog
    .command(`${SUBNAME} config`, "Generate cache configuration exercises")
    .option("--seed <value>", "seed for reproducible random generation")
    .option("-x, --save <prefix>", "save with prefix or dump json")
    .option("-m, --membits <num>", "main address size", prog.INT)
    .option("-b, --blockbits <num>", "log2 of block size", prog.INT)
    .option("-i, --indexbits <num>", "log2 of cache sets", prog.INT)
    .option("-w, --ways <num>", "cache associativity, as a power of two", prog.INT)
    .option("-s, --cachesizebits <num>", "log2 of cache size", prog.INT);

  addCompileOptions(cmd).action(async (args, options) => {
    let result = produceArtifacts(generateConfig(options));
    if (options.save) {
      return writeArtifacts(result.latex, options);
    }
    console.log(JSON.stringify(result));
  });

  let simCmd = prog
    .command(`${SUBNAME} sim`, "Generate 4-block cache simulation exercises")
    .option("--seed <value>", "seed for reproducible random generation")
    .option("-x, --save <prefix>", "save with prefix or dump json")
    .option("-n, --accesses <num>", "number of memory accesses", prog.INT, 6)
    .option("--hits <num>", "exact number of hits to generate", prog.INT)
    .option("--min-hits <num>", "minimum number of hits", prog.INT)
    .option("--max-hits <num>", "maximum number of hits", prog.INT)
    .option("-m, --membits <num>", "main address size", prog.INT)
    .option("-b, --blockbits <num>", "log2 of block size", prog.INT)
    .option("-w, --ways <num>", "cache associativity, as 1, 2, or 4", prog.INT);

  addCompileOptions(simCmd).action(async (args, options) => {
    let result = produceSimulationArtifacts(generateSimulation(options));
    if (options.save) {
      return writeArtifacts(result.latex, options);
    }
    console.log(JSON.stringify(result));
  });
};

module.exports = { register };

if (require.main === module) {
  const prog = require("caporal");
  register(prog);
  prog.parse([
    process.argv[0],
    process.argv[1],
    SUBNAME,
    ...process.argv.slice(2)
  ]);
}
