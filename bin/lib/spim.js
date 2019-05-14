const _ = require("lodash");
let label = "((?<label>[\\w]+):)";
let comment = "(?<comment>#[\\w\\W]+)";
let instruction = "(?<instruction>[\\w]+)(\\s)*(?<operands>[^#]*)";
let directive = "\\.(?<directive>[\\w]+)(\\s)*(?<parameters>[^#]*)";
let contents = `(${directive}|${instruction})`;
let regexps = `${label}?(\\s)*${contents}?${comment}?`;

const { execWithStringStdErr } = require("./common");

let testReg = output => {
  let extrreg = /(?<reg>[\w]+)\s+(\((?<alt>[\w]+)\))?\s+=\s(?<value>[a-f0-9]{8})/g;
  let array1;
  let results = {};
  while ((array1 = extrreg.exec(output)) !== null) {
    let { reg, alt, value } = array1.groups;
    if (!_.isUndefined(alt)) {
      results[alt] = value;
    } else results[reg] = value;
  }
  return results;
};

let run = async filename => {
  let script = `
   load "${filename}"
   run
   print_all_regs hex
   exit
`;
  return execWithStringStdErr(path => `cat ${path} | spim `, script, {
    postfix: ".script",
    cleanup: false
  }).then(([stdout]) => {
    return testReg(stdout);
  });
};

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

let fakeConsole = "";

let clog = (p, x) => {
  fakeConsole = fakeConsole + `${p}${_.trim(x)}\n`;
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
      else if (lastidx !== idx) clog("", "");
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

let beautifyString = prog => {
  fakeConsole = "";
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
  return fakeConsole;
};

let beautifyProg = prog => {
  console.log(beautifyString(prog));
};

module.exports = { beautifyProg, beautifyString, run };
