#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const { execWithStringStdErr } = require("./lib/common");
let $gstd = require("get-stdin");
const _ = require("lodash");

let label = "((?<label>[\\w]+):)";
let comment = "(?<comment>#[\\w\\W]+)";
let instruction = "(?<instruction>[\\w]+)(\\s)*(?<operands>[^#]*)";
let directive = "\\.(?<directive>[\\w]+)(\\s)*(?<parameters>[^#]*)";
let contents = `(${directive}|${instruction})`;
let regexps = `${label}?(\\s)*${contents}?${comment}?`;

let parseLine = line => {
  let r = line.match(regexps).groups;
  if (r.operands) {
    r.operands = _.trim(r.operands, " \t\r");
  }
  if (r.directive) {
    r.directive = _.trim(r.directive, " \t\r");
  }
  if (r.instruction) {
    r.instruction = _.trim(r.instruction, " \t\r");
  }
  if (r.parameters) {
    r.parameters = _.trim(r.parameters, " \t\r");
  }
  return r;
};

let clog = (p, x) => {
  console.log(`${p}${_.trim(x)}`);
};

let printLine = _.curry(
  (
    {
      pad,
      maxInstructionSize,
      maxOperandsSize,
      maxDirectiveSize,
      maxParametersSize,
      lastidx
    },
    line,
    idx
  ) => {
    if (!line.directive && !line.instruction && !line.label) {
      // Just a line comment.
      if (line.comment) clog("", line.comment);
      else if (lastidx !== idx) console.log("");
    }
    if (line.label) {
      clog("", `${line.label}:`);
    }
    if (line.instruction) {
      let instr = _.padEnd(line.instruction, maxInstructionSize + 1);
      let ops = _.padEnd(line.operands, maxOperandsSize + 1);
      line.comment = line.comment ? line.comment : "";

      clog(pad, `${instr}${ops}${line.comment}`);
    }
    if (line.directive) {
      let instr = _.padEnd(line.directive, maxDirectiveSize + 1);
      let ops = _.padEnd(line.parameters, maxOperandsSize + 1);
      line.comment = line.comment ? line.comment : "";
      clog(pad, `.${instr}${ops}${line.comment}`);
    }
  }
);

let maxSize = (instr, name) => {
  return _.max(_.map(instr, i => (i[name] ? i[name].length : 0)));
};

let beautifyProg = (options, prog) => {
  let instrs = _.map(prog.split("\n"), parseLine);
  let maxLabelSize = maxSize(instrs, "label");
  let maxInstructionSize = maxSize(instrs, "instruction");
  let maxOperandsSize = maxSize(instrs, "operands");
  let maxDirectiveSize = maxSize(instrs, "directive");
  let maxParametersSize = maxSize(instrs, "parameters");
  let pad = _.repeat(" ", maxLabelSize + 2);
  _.map(
    instrs,
    printLine({
      maxLabelSize,
      maxInstructionSize,
      maxOperandsSize,
      maxDirectiveSize,
      maxParametersSize,
      pad,
      lastidx: instrs.length - 1
    })
  );
};

function escapeAttrValue(attrValue) {
  return String(attrValue)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let parseError = line => {
  let regexp = /spim: \(parser\) (?<error>[\w\s]+) on line (?<line>\d+) of file (?<file>[\/\-\.\w\s]+)/;
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

let run = async (options, logger, filename) => {
  let script = `
   load "${filename}"
   run
   print_all_regs hex
   exit
`;
  return execWithStringStdErr(
    path => `cat ${path} | ${options.spimBinary}  -noexception`,
    script,
    { postfix: ".script", cleanup: false, logger: logger }
  )
    .then(([stdout, stderr]) => {
      logger.debug(stderr);
      console.log(stdout);
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
    .action(async (args, options) => {
      let program = await (args.file
        ? $fs.readFile(args.file, "utf-8")
        : $gstd());
      beautifyProg(options, program);
    })
    .command("run", "run a source file")
    .argument("<file>", `Source file`)
    .option(
      "-b, --spim-binary <string>",
      "absolute path of spim executable",
      prog.STRING,
      "spim -delayed_branches -delayed_loads"
    )
    .action(async (args, options, logger) => {
      run(options, logger, args.file);
    });
  prog.parse(process.argv);
};

main();
