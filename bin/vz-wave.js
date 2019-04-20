#!/usr/bin/env node
"use strict";

const prog = require("caporal");

let _ = require("lodash");
let $fs = require("mz/fs");
let { exec } = require("mz/child_process");
let $gstd = require("get-stdin");
let vcdParser = require("vcd-parser");

let tmp = require("tmp-promise");
let { execWithString } = require("./lib/common");

let wave2pdf = (options, wavedata) => {
  return tmp.file({ postfix: ".svg" }).then(tmpsvg => {
    return execWithString(
      path =>
        `phantomjs ${__dirname}/../node_modules/wavedrom-cli/bin/wavedrom-cli.js -i ${path} -s ${
          tmpsvg.path
        }`,
      wavedata,
      { postfix: ".js", cleanup: false, logger: options.logger }
    )
      .then(() => {
        return exec(`cairosvg ${tmpsvg.path} -f pdf -o ${options.output}`);
      })
      .then(() => {
        if (!options.keep) tmpsvg.cleanup();
      });
  });
};

let parseSignal = (end, sig) => {
  let v = [];
  let last = "q";
  for (let i = 0; i < end; i++) {
    let value = _.last(_.filter(sig.wave, s => parseInt(s[0]) <= i))[1];
    if (value !== last) {
      v.push(value);
      last = value;
    } else {
      v.push(".");
    }
  }
  return { name: sig.name, wave: _.join(v, "") };
};

let produceWave = (args, options, vcd) => {
  let sigs = vcd.signal;
  console.log(_.map(sigs, s => s.name));
  let observables = options.signals.split(",");
  let fsigs = _.map(observables, o => {
    return _.find(sigs, s => s.name === o);
  });
  return {
    signal: _.map(fsigs, _.curry(parseSignal)(options.end))
  };
};

let main = () => {
  prog
    .description("Produce a wave diagram")
    .command("wavedrom2pdf", "produce a wave diagram")
    .argument(
      "[file]",
      "JSON file (see http://wavedrom.com/tutorial.html for syntax)"
    )
    .option(
      "-o, --output <filename>",
      "Output filename",
      prog.STRING,
      "output.pdf"
    )
    .action((args, options, logger) => {
      options.logger = logger;
      let wave_data = args.file ? $fs.readFile(args.file, "utf-8") : $gstd();
      wave_data
        .then(data => wave2pdf(options, data))
        .catch(e => {
          logger.error(e);
        });
    })
    .command("vcd2pdf", "produce a wave diagram from a vcd")
    .argument("<file>", "source VCD file")
    .option("--end <integer>", "time ends at", prog.INTEGER, 10)
    .option("-s, --signals <string>", "comma separated list of signals")
    .action((args, options, logger) => {
      $fs
        .readFile(args.file, "utf-8")
        .then(data => vcdParser.parse(data))
        .then(data => produceWave(args, options, data))
        .then(data => {
          console.log(data);
          options.output = args.file + ".pdf";
          options.logger = logger;
          return wave2pdf(options, JSON.stringify(data));
        })
        .catch(e => {
          logger.error(e);
        });
    });
  prog.parse(process.argv);
};

main();
