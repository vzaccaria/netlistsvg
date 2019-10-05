#!/usr/bin/env node
"use strict";

const prog = require("caporal");

let _ = require("lodash");
let $fs = require("mz/fs");
let $gstd = require("get-stdin");
let nomnoml = require("nomnoml");

let { execWithString } = require("./lib/common");

let nom2svg = _.curry((options, data) => {
  return nomnoml.renderSvg(data);
});

let svg2pdf = _.curry((options, svgdata) => {
  return execWithString(
    tmpfile => `cairosvg ${tmpfile} -f pdf -o ${options.output}`,
    svgdata,
    {
      cleanup: !options.keep,
      logger: options.logger
    }
  );
});

let main = () => {
  prog
    .description("Produce a diagram from a nomnom file")
    .argument("[file]", "source file (or stdin). ")
    .option(
      "-o, --output <filename>",
      "Output filename",
      prog.STRING,
      "output.pdf"
    )
    .action((args, options) => {
      let file_p = args.file ? $fs.readFile(args.file, "utf-8") : $gstd();
      file_p.then(nom2svg(options)).then(svg2pdf(options));
    });
  prog.parse(process.argv);
};

main();
