#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const { latexArtifact } = require("./lib/artifacts");
const { lab } = require("./lib/common");
let $gstd = require("get-stdin");

let _ = require("lodash");
let $fs = require("mz/fs");

let annotate = () => {
  return `
\\begin{tikzpicture}[overlay, remember picture]
\\draw[color=gray!50, very thick] ($ (pic cs:mla) + (-10pt,4pt) $) -- ($ (pic cs:mlc) + (-10pt, 0pt) $) node [midway, left, xshift=-3, color=black!40] {pippo};
\\end{tikzpicture}
`;
};

let code = (data, options) => {
  data = _.map(data.split("\n"), (l, i) => {
    let mk = `?\\tikzmark{${lab(options.prefix, i)}}?`;
    return options.pos === "left" ? `${mk}${l}` : `${l}${mk}`;
  }).join("\n");
  data = `\\begin{minted}[escapeinside=??]{${options.language}}
${data}
\\end{minted}`;
  return data;
};

let produceEnv = (data, options) => {
  return {
    latex: [
      latexArtifact(
        code(data, options) + annotate(),
        "code",
        "article",
        "pdflatex",
        "--usepackage minted,tikz --usetikzlibrary tikzmark -r varwidth -b"
      )
    ]
  };
};

let main = () => {
  prog
    .description("Create a referenceable minted env for source code")
    .argument("[file]", `Source file`)
    .option("-l, --language <string>", "language", prog.STRING, "c")
    .option("-p, --prefix <string>", "prefix for labels", prog.STRING, "ml")
    .option("-s, --pos <string>", "position (left|right)", prog.STRING, "left")
    .option("-t, --latex")
    .action((args, options) => {
      let fp = args.file ? $fs.readFile(args.file, "utf8") : $gstd();
      fp.then(data => {
        let res = produceEnv(data, options);
        if (!options.latex) console.log(JSON.stringify(res));
        else console.log(res.latex[0].code);
      });
    });
  prog.parse(process.argv);
};

main();
