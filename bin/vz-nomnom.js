#!/usr/bin/env node
"use strict";

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

const SUBNAME = "nomnom";

let register = prog => {
  prog
    .command(SUBNAME, "Produce a diagram from a nomnom file")
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
