#!/usr/bin/env node
"use strict";

const prog = require("caporal");

let lib = require("../lib");
let _ = require("lodash");
let $fs = require("mz/fs");
let $gstd = require("get-stdin");
let path = require("path");
let open = require("open");
let gaze = require("gaze");

let tmp = require("tmp-promise");
let { execWithString } = require("./lib/common");

let svg2pdf = (options, outputpdf, svgdata) => {
  return execWithString(
    (tmpfile) => `cairosvg ${tmpfile} -f pdf -o ${outputpdf}`,
    svgdata,
    {
      cleanup: !options.keep,
      logger: options.logger,
    }
  );
};

let verilog2svg = (args, options) => {
  let json2svg = (jsonfile) => {
    let skin_data = $fs.readFile(options.skin, "utf-8");
    let jsondata = $fs.readFile(jsonfile, "utf-8");
    options.logger.info("Rendering json");
    return Promise.all([skin_data, jsondata])
      .then(([sd, nd]) => {
        nd = nd.replace(/\$_DFF_NP0_/gi, "DFF");
        nd = JSON.parse(nd);
        return lib.render(sd, nd);
      })
      .catch((e) => {
        console.log(
          `"${e}" detected while rendering the following json to svg`
        );
        console.log(JSON.stringify(jsondata));
        throw "Bailing out because cant render svg";
      });
  };

  let verilog2json = (jsonfile, verilogdata) => {
    let command = `yosys -q -p "${options.script}; write_json ${jsonfile}" -f verilog`;
    let loadopts;
    if (options.ilang) {
      loadopts = `-f ilang -S`;
    } else {
      loadopts = `-S`;
    }
    return execWithString(
      (tmpfile) => `${command} ${loadopts} ${tmpfile}`,
      verilogdata,
      {
        cleanup: !options.keep,
        logger: options.logger,
      }
    )
      .then(() => jsonfile)
      .catch((e) => {
        options.logger.info(`ignoring error ${e}`);
        return jsonfile;
      });
  };

  let outputfile = options.output
    ? options.output
    : args.file
    ? path.basename(args.file, ".v") + ".pdf"
    : "output.pdf";
  return tmp
    .file({ postfix: ".json", keep: options.keep })
    .then((jsonfilename) => {
      let verilogdata_p = args.file
        ? $fs.readFile(args.file, "utf-8")
        : $gstd();
      return verilogdata_p
        .then(_.curry(verilog2json)(jsonfilename.path))
        .then(json2svg)
        .then(_.curry(svg2pdf)(options)(outputfile))
        .then(() => (options.keep ? 0 : jsonfilename.cleanup()))
        .then(() => outputfile);
    });
};

let main = () => {
  prog
    .description("Produce a netlist diagram from a verilog file")
    .argument("[file]", "source file (or stdin). Can be verilog or JSON")
    .option("-o, --output <filename>", "Output filename")
    .option(
      "--script",
      "Yosys processing commands",
      prog.STRING,
      "prep -auto-top"
    )
    .option("--simple", "Simple map")
    .option("--aig", "AIG map")
    .option(
      "--skin <filename>",
      "Use skin <filename>",
      prog.STRING,
      `${__dirname}/../lib/vz-default.svg`
    )
    .option("-w, --watch", "Watch for input file to change")
    .option("-k, --keep", "Dont cleanup")
    .option("-p, --open", "Open file")
    .option("-i, --ilang", "If input file is ilang instead of verilog")
    .action((args, options, logger) => {
      options.logger = logger;
      if (options.aig) options.script = "prep -flatten -auto-top; aigmap";
      if (options.simple) options.script = "prep -flatten -auto-top; simplemap";
      verilog2svg(args, options)
        .then((output) => {
          if (options.open) open(output);
          if (options.watch) {
            let towatch = _.concat([], [args.file]);
            console.log("Watching " + towatch);
            gaze(towatch, function () {
              this.on("error", (e) => {
                logger.debug(`Suppressing error ${e}`);
              });
              this.on("changed", () => verilog2svg(args, options));
            });
          }
        })
        .catch((e) => {
          logger.error(e);
        });
    });
  prog.parse(process.argv);
};

main();
