#!/usr/bin/env node
"use strict";

const prog = require("caporal");

let lib = require("../lib");
let _ = require("lodash");
let $fs = require("mz/fs");
let { exec } = require("mz/child_process");
let $gstd = require("get-stdin");
let debug = require("debug")("netsvg");

let tmp = require("tmp-promise");

let execWithString = (cmd, string, options) => {
  let keep = !_.get(options, "cleanup", true);
  let postfix = _.get(options, "postfix", ".tmp");
  return tmp.file({ postfix, keep }).then(o => {
    return $fs
      .writeFile(o.path, string, "utf8")
      .then(() => {
        let cc = cmd(o.path);
        debug(cc);
        return exec(cc);
      })
      .then(a => {
        if (!keep) {
          o.cleanup();
        }
        return a[0];
      });
  });
};

let main = () => {
  prog
    .description("Produce either a netlist diagram or a wave diagram")
    .command("netlist", "produce a netlist diagram")
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
            )
          );
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
    })
    .command("wave", "produce a wave diagram")
    .argument("[file]", "JSON file")
    .action((args, options) => {
      let wave_data = args.file ? $fs.readFile(args.file, "utf-8") : $gstd();
      wave_data.then(file => {
        return execWithString(
          path =>
            `phantomjs ${__dirname}/../node_modules/wavedrom-cli/bin/wavedrom-cli.js -i ${path} -s /dev/stdout`,
          file,
          { postfix: ".js", cleanup: false }
        )
          .then(svg => {
            return execWithString(path => `cairosvg ${path} -f ps`, svg);
          })
          .then(a => {
            console.log(a);
          });
      });
    });
  prog.parse(process.argv);
};

main();
