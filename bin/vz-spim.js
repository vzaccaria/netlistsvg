#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const { execWithStringStdErr } = require("./lib/common.js");
let $gstd = require("get-stdin");
const _ = require("lodash");
const { beautifyProg, run } = require("./lib/spim");

let parseError = line => {
  let regexp = /spim: \(parser\) (?<error>[\w\s\']+) on line (?<line>\d+) of file (?<file>[\/\-\.\w\s]+)/;
  let x = line.match(regexp);
  if (!_.isNull(x)) {
    return x.groups;
  } else {
    return null;
  }
};

let wrap = (file, c) => {
  return `<?xml version="1.0" encoding="utf-8"?>
   <checkstyle version="4.3">
    <file name="${file}">
${c}
    </file>
</checkstyle>
 `;
};

let printError = e => {
  return `
<error line="${e.line}" column="0" severity="error" message="${
    e.error
  }" source="${e.file}" />`;
};

let assemble = (filename, options, logger, program) => {
  return execWithStringStdErr(
    path => `${options.spimBinary} -noexception -dump -f ${path}`,
    program,
    { postfix: ".asm", cleanup: true, logger: logger }
  )
    .then(([stdout, stderr]) => {
      logger.debug(stderr);
      logger.debug(stdout);
      return wrap(
        filename,
        _.join(
          _.map(_.filter(_.map(stderr.split("\n"), parseError)), printError),
          "\n"
        )
      );
    })
    .then(console.log);
};

let $fs = require("mz/fs");

let main = () => {
  prog
    .description("SPIM utils")
    .command("check", "decorate a source file")
    .argument("[file]", `Source file`)
    .option(
      "-b, --spim-binary <string>",
      "absolute path of spim executable",
      prog.STRING,
      "spim"
    )
    .action(async (args, options, logger) => {
      let program = await (args.file
        ? $fs.readFile(args.file, "utf-8")
        : $gstd());
      try {
        await assemble(args.file, options, logger, program);
      } catch (e) {
        console.log(e);
      }
    })
    .command("format", "format a source file")
    .argument("[file]", `Source file`)
    .action(async args => {
      let program = await (args.file
        ? $fs.readFile(args.file, "utf-8")
        : $gstd());
      beautifyProg(program);
    })
    .command("run", "run a source file")
    .argument("<file>", `Source file`)
    .action(async args => {
      console.log(await run(args.file));
    });
  prog.parse(process.argv);
};

main();
