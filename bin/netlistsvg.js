#!/usr/bin/env node
"use strict";

const prog = require("caporal");

let lib = require("../lib");
let _ = require("lodash");
let $fs = require("mz/fs");
let { exec } = require("mz/child_process");
let $gstd = require("get-stdin");

let tmp = require("tmp-promise");

let execWithString = (cmd, string) => {
  return tmp.file().then(o => {
    return $fs
      .writeFile(o.path, string, "utf8")
      .then(() => exec(cmd(o.path)))
      .then(a => {
        o.cleanup();
        return a[0];
      });
  });
};

let main = () => {
  prog
    .description("Produce a postscript file from a yosys netlist")
    .argument("[file]", "source file (or stdin). Can be verilog or JSON")
    .option(
      "--verilog",
      "interpret [file] as a verilog file to be synth. into GTECH"
    )
    .option(
      "--skin <filename>",
      "Use skin <filename>",
      prog.STRING,
      `${__dirname}/../lib/default.svg`
    )
    .option("--svgonly", "Just generate svg")
    .action((args, options) => {
      let skin_data = $fs.readFile(options.skin, "utf-8");
      let netlist_data;
      if (options.verilog) {
        if (!args.file) {
          netlist_data = $gstd().then(filed =>
            execWithString(
              path => `yosys -q -o /dev/stdout -b json -f verilog -S ${path}`,
              filed
            ));
        } else {
          netlist_data = exec(
            `yosys -q -o /dev/stdout -b json -S ${args.file}`
          ).then(a => a[0]);
        }
      } else {
        netlist_data = args.file ? $fs.readFile(args.file, "utf-8") : $gstd();
      }
      Promise.all([skin_data, netlist_data])
        .then(([sd, nd]) => {
          nd = JSON.parse(nd);
          return lib.render(sd, nd);
        })
        .then(svg => {
          if (!options.svgonly) {
            return execWithString(path => `cairosvg ${path} -f ps`, svg);
          } else {
            return svg;
          }
        })
        .then(a => {
          console.log(a);
        });
    });
  prog.parse(process.argv);
};

main();
