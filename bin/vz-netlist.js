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

let svg2pdf = (options, outputpdf, svgdata) => {
  return execWithString(
    tmpfile => `cairosvg ${tmpfile} -f pdf -o ${outputpdf}`,
    svgdata,
    {
      cleanup: !options.keep,
      logger: options.logger
    }
  );
};

let verilog2svg = (args, options) => {
  let json2svg = jsonfile => {
    let skin_data = $fs.readFile(options.skin, "utf-8");
    let jsondata = $fs.readFile(jsonfile, "utf-8");
    options.logger.info("Rendering json");
    return Promise.all([skin_data, jsondata])
      .then(([sd, nd]) => {
        nd = JSON.parse(nd);
        return lib.render(sd, nd);
      })
      .catch(e => {
        console.log(
          `"${e}" detected while rendering the following json to svg`
        );
        console.log(JSON.stringify(jsondata));
        throw "Bailing out because cant render svg";
      });
  };

  let verilog2json = (jsonfile, verilogdata) => {
    let command = `yosys -q -p "${
      options.script
    }; write_json ${jsonfile}" -f verilog`;
    return execWithString(tmpfile => `${command} -S ${tmpfile}`, verilogdata, {
      cleanup: !options.keep,
      logger: options.logger
    })
      .then(() => jsonfile)
      .catch(e => {
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
    .then(jsonfilename => {
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
      `${__dirname}/../lib/vz-default.svg`
    )
    .option("-w, --watch", "Watch for input file to change")
    .option("-k, --keep", "Dont cleanup")
    .option("-p, --open", "Open file")
    .action((args, options, logger) => {
      options.logger = logger;
      if (options.aig) options.script = "prep -flatten -auto-top; aigmap";
      if (options.simple) options.script = "prep -flatten -auto-top; simplemap";
      verilog2svg(args, options)
        .then(output => {
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
        })
        .catch(e => {
          logger.error(e);
        });
    })
    .command("wave2pdf", "produce a wave diagram")
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
