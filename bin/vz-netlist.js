#!/usr/bin/env node
"use strict";

const prog = require("caporal");

let lib = require("../lib");
let _ = require("lodash");
let $fs = require("mz/fs");
let { exec } = require("mz/child_process");
let $gstd = require("get-stdin");
let path = require("path");
let open = require("open");
let gaze = require("gaze");
let vcdParser = require("vcd-parser");

let tmp = require("tmp-promise");

let execWithString = (cmd, string, options) => {
  let keep = !_.get(options, "cleanup", true);
  let postfix = _.get(options, "postfix", ".tmp");
  return tmp.file({ postfix, keep }).then(o => {
    return $fs
      .writeFile(o.path, string, "utf8")
      .then(() => {
        let cc = cmd(o.path);
        options.logger.debug(cc);
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

let verilog2svg = (args, options) => {
  let skin_data = $fs.readFile(options.skin, "utf-8");
  let outputfile = options.output
    ? options.output
    : args.file
      ? path.basename(args.file, ".v") + ".pdf"
      : "output.pdf";
  let basename = outputfile;
  let command = `yosys -p "${
    options.script
  }; write_json ${basename}.json" -f verilog`;
  let filed = args.file ? $fs.readFile(args.file, "utf-8") : $gstd();
  let jsonfile = filed
    .then(data => {
      return execWithString(tmpfile => `${command} -S ${tmpfile}`, data, {
        cleanup: !options.keep,
        logger: options.logger
      });
    })
    .then(() => $fs.readFile(`${basename}.json`, "utf-8"));
  return Promise.all([skin_data, jsonfile])
    .then(([sd, nd]) => {
      nd = JSON.parse(nd);
      return lib.render(sd, nd);
    })
    .then(svg =>
      execWithString(
        tmpfile => `cairosvg ${tmpfile} -f pdf -o ${outputfile}`,
        svg,
        {
          cleanup: !options.keep,
          logger: options.logger
        }
      )
    )
    .then(() => outputfile);
};

let wave2pdf = (options, file) => {
  return execWithString(
    path =>
      `phantomjs ${__dirname}/../node_modules/wavedrom-cli/bin/wavedrom-cli.js -i ${path} -s /dev/stdout`,
    file,
    { postfix: ".js", cleanup: false, logger: options.logger }
  )
    .then(svg => {
      return execWithString(
        path => `cairosvg ${path} -f pdf -o ${options.output}`,
        svg,
        { logger: options.logger }
      );
    })
    .then(a => {
      console.log(a);
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
    .description("Produce either a netlist diagram or a wave diagram")
    .command("netlist", "produce a netlist diagram")
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
      `${__dirname}/../lib/default.svg`
    )
    .option("-w, --watch", "Watch for input file to change")
    .option("-k, --keep", "Dont cleanup")
    .option("-p, --open", "Open file")
    .action((args, options, logger) => {
      options.logger = logger;
      if (options.aig) options.script = "prep -flatten -auto-top; aigmap";
      if (options.simple) options.script = "prep -flatten -auto-top; simplemap";
      verilog2svg(args, options).then(output => {
        if (options.open) open(output);
        if (options.watch) {
          let towatch = _.concat([], [args.file]);
          console.log("Watching " + towatch);
          gaze(towatch, function() {
            this.on("error", e => {
              logger.debug(`Suppressing error ${e}`);
            });
            this.on("changed", () => verilog2svg(args, options));
          });
        }
      });
    })
    .command("wave", "produce a wave diagram")
    .argument(
      "[file]",
      "JS file (see http://wavedrom.com/tutorial.html for syntax)"
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
      wave_data.then(data => wave2pdf(options, data));
    })
    .command("vcdparse", "read vcd")
    .argument("file", "source VCD file")
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
        });
    });
  prog.parse(process.argv);
};

main();
