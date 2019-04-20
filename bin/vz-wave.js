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
let { latexArtifact, saveArtifacts } = require("./lib/artifacts");

let wave2tikz = (options, wavedata) => {
  return execWithString(
    path => `${__dirname}/lib/wavedromtikz.py wavedrom ${path}`,
    wavedata,
    { postfix: ".json", cleanup: false, logger: options.logger }
  );
};

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
        return exec(
          `cairosvg ${tmpsvg.path} -f pdf -o ${options.dumpClassicPdf}`
        );
      })
      .then(() => {
        if (!options.keep) tmpsvg.cleanup();
      });
  });
};

let trimName = n => {
  return _.last(n.split("."));
};

let parseSignal = (options, sig) => {
  let v = [];
  let last = "q";
  let isclock = sig.name.match(/c[l]?[o]?k/i) ? true : false;
  let negedge = !options.posedgeClock;
  let nc = isclock && negedge;
  let pc = isclock && !negedge;

  for (let i = 0; i < options.end; i++) {
    let value = _.last(_.filter(sig.wave, s => parseInt(s[0]) <= i))[1];
    if (pc) {
      value = value === "1" ? "H" : "l";
    } else if (nc) {
      value = value === "0" ? "L" : "h";
    }
    if (value !== last) {
      v.push(value);
      last = value;
    } else {
      v.push(".");
    }
  }
  return {
    name: options.trimNames ? trimName(_.toUpper(sig.name)) : sig.name,
    wave: _.join(v, "")
  };
};

let produceWave = _.curry((args, options, vcd) => {
  let sigs = vcd.signal;
  // console.log(_.map(sigs, s => s.name));
  let observables = options.signals.split(",");
  let fsigs = _.map(observables, o => {
    return _.find(sigs, s => s.name === o);
  });
  let s = {
    signal: _.map(fsigs, _.curry(parseSignal)(options))
  };
  // console.log(s);
  return s;
});

let readWavedrom = (args, options) => {
  let file_p = $fs.readFile(args.file, "utf-8");
  let wavedrom = options.isVcd
    ? file_p
        .then(vcdParser.parse)
        .then(produceWave(args, options))
        .then(JSON.stringify)
    : file_p;
  return wavedrom;
};

let processWhitelist = (wavedrom, options) => {
  if (options.whiteList) {
    let wd = _.map(JSON.parse(wavedrom).signal, ({ name, wave }) => {
      if (!_.includes(options.whiteList, name)) return { name, wave: "" };
      else return { name, wave };
    });

    return JSON.stringify({
      signal: wd
    });
  } else {
    return wavedrom;
  }
};

let main = () => {
  prog
    .description("Produce a wave diagram")
    .argument("<file>", "source Wavedrom/VCD file")
    .option("--end <integer>", "time ends at", prog.INTEGER, 10)
    .option("-s, --signals <string>", "comma separated list of signals")
    .option("-a, --save <prefix>", "save with prefix")
    .option("-c, --is-vcd", "input is a vcd file")
    .option("-p, --posedge-clock", "clock is posedge, otherwise negedge")
    .option("-n, --trim-names", "trim hierarchic path names")
    .option("-w, --white-list <names>", "whitelisted names", prog.LIST)
    .option(
      "-z, --dump-tikz",
      "Just dump only tikz, not reproducible artifacts"
    )
    .option(
      "-d, --dump-classic-pdf <file>",
      "Produce the wave from the classic wavedrom cli"
    )
    .action((args, options, logger) => {
      options.logger = logger;
      readWavedrom(args, options)
        .then(wavedrom => {
          let whitelisted = processWhitelist(wavedrom, options);
          Promise.all([
            wave2tikz(options, wavedrom),
            wave2tikz(options, whitelisted)
          ]).then(([complete, whitel]) => {
            let artifacts = [
              latexArtifact(
                complete,
                "wave",
                "standalone",
                "pdflatex",
                `-i ${__dirname}/preambles/wavedrom2tikz.tex --usepackage ifthen --usetikzlibrary patterns`
              ),
              latexArtifact(
                whitel,
                "wave whitelisted",
                "standalone",
                "pdflatex",
                `-i ${__dirname}/preambles/wavedrom2tikz.tex --usepackage ifthen --usetikzlibrary patterns`
              )
            ];
            let result = { latex: artifacts };
            if (options.save) {
              saveArtifacts(result.latex, options.save);
            } else {
              if (options.dumpTikz) {
                console.log(complete);
              } else {
                if (options.dumpClassicPdf) {
                  return wave2pdf(options, wavedrom);
                } else {
                  console.log(JSON.stringify(result, 0, 4));
                }
              }
            }
          });
        })
        .catch(e => {
          logger.error(e);
        });
    });
  prog.parse(process.argv);
};

main();
