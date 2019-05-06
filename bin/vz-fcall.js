#!/usr/bin/env node
"use strict";

const prog = require("caporal");
// const { execWithStringStdErr } = require("./lib/common");
let $gstd = require("get-stdin");
const _ = require("lodash");

let $fs = require("mz/fs");

let vrre = /(?<name>[\w\[\]]+)\/((?<register>\$[\w]+)|(?<size>[\d]+))/;

let _getvarreg = s => {
  let gg = s.match(vrre).groups;
  if (_.isUndefined(gg.size)) gg.size = 4;
  else gg.size = parseInt(gg.size);
  return gg;
};

let generatePrologueState = (data, { callee, caller }) => {
  callee = `$ref/${callee}`;
  caller = `$ref/${caller}`;
  let fs = data.functions;
  let cee = fs[callee];
  let cells = [];

  cells.push({ type: "zone", name: caller, size: 0 });

  _.map(cee.parameters, l => {
    let { name, register, size } = _getvarreg(l);
    if (!register) {
      cells.push({ type: "parameter", name: name, size: size });
    }
  });

  if (!data.omitFramePointer) {
    cells.push({ type: "savedreg", name: "$fp", pointedBy: "$fp", size: 4 });
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
      console.log(generatePrologueState(data, { caller, callee }));
    });
  prog.parse(process.argv);
};

main();
