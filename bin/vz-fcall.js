#!/usr/bin/env node
"use strict";

const prog = require("caporal");
// const { execWithStringStdErr } = require("./lib/common");
let $gstd = require("get-stdin");
const _ = require("lodash");

let $fs = require("mz/fs");

let vrre = /(?<name>[\w\[\.\]]+)\/((?<register>\$[\w]+)|(?<size>[\d]+))/;

let _getvarreg = s => {
  let gg = s.match(vrre).groups;
  if (_.isUndefined(gg.size)) gg.size = 4;
  else gg.size = parseInt(gg.size);
  return gg;
};

let wrap = (data, c) => {
  return `
\\begin{tikzpicture}[start chain=1 going ${data.stackgrows}, node distance=0mm,
zone/.style={on chain=1, dashed, draw=gray, text centered, text width=3cm, minimum height = 30mm, text=gray},
parameter/.style={on chain=1, dashed, draw=gray, text centered, text width=3cm, minimum height = 10mm, text=gray},
savedreg/.style={on chain=1, draw=black, text centered, text width=3cm, minimum height = 10mm},
localvar/.style={on chain=1, draw=black, text centered, text width=3cm, minimum height = 10mm, fill=blue!30}]
${c}
\\end{tikzpicture}
`;
};

let _n = s => s.replace("$", "\\$");

let gpdiag = (data, cells) => {
  let txt = _.join(
    _.map(cells, i => {
      let lab = "";
      let cause = "";
      if (!_.isUndefined(i.cause)) {
        cause = `(${i.cause})`;
      }
      if (!_.isUndefined(i.offset) && i.type !== "zone") {
        lab = `,label=right:{${i.offset}}`;
      }
      if (!_.isUndefined(i.pointedBy)) {
        lab = `${lab},label=left:${_n(i.pointedBy)}`;
      }
      return `\\node [${i.type}${lab}] {${_n(i.name)} ${cause}};`;
    }),
    "\n"
  );
  return wrap(data, txt);
};

let gpstate = (data, { callee, caller }) => {
  callee = `$ref/${callee}`;
  let ncaller = `$ref/${caller}`;
  let fs = data.functions;
  let cee = fs[callee];
  let cells = [];

  cells.push({ type: "zone", name: caller, size: 0, cause: "previous frame" });

  _.map(cee.parameters, l => {
    let { name, register, size } = _getvarreg(l);
    if (!register) {
      cells.push({ type: "parameter", name: name, size: size });
    }
  });

  if (!data.omitFramePointer) {
    cells.push({
      type: "savedreg",
      name: "$fp",
      pointedBy: "$fp",
      size: 4,
      cause: "previous"
    });
  }

  /* Allocate space on the stack for local variables */
  if (!cee.isleaf) {
    cells.push({ type: "savedreg", name: "$ra", size: 4 });
  }

  _.map(cee.localvars, l => {
    let { name, register, size } = _getvarreg(l);
    if (register) {
      cells.push({
        type: "savedreg",
        name: register,
        cause: `needed for ${name}`,
        size: 4
      });
    } else {
      cells.push({
        type: "localvar",
        name,
        size
      });
    }
  });
  cells[cells.length - 1].pointedBy = "$sp";

  let overallsize = _.sum(_.map(cells, "size"));
  let offset = overallsize - 4;
  _.forEach(cells, c => {
    c.offset = offset;
    offset = offset - c.size;
  });

  return cells;
};

let main = () => {
  prog
    .description("Function call utils")
    .command("prologue", "generates stack and register usage for a call")
    .argument("<json>", `File describing the call sequence`)
    .argument("<invocation>", `Example: 'f,g' means f invokes g`)
    .action(async args => {
      let data = await (args.json ? $fs.readFile(args.json, "utf8") : $gstd());
      data = JSON.parse(data);
      let [caller, callee] = args.invocation.split(",");
      console.log(gpdiag(data, gpstate(data, { caller, callee })));
    });
  prog.parse(process.argv);
};

main();
