#!/usr/bin/env node
"use strict";

const prog = require("caporal");
// const { execWithStringStdErr } = require("./lib/common");
let $gstd = require("get-stdin");
const _ = require("lodash");
const { beautifyString, runString } = require("./lib/spim");
const path = require("path");
const chalk = require("chalk");
let { latexArtifact, saveArtifacts } = require("./lib/artifacts");

let $fs = require("mz/fs");

let name = "(?<name>[\\w[\\.\\]]+)";
let registername = "(?<register>\\$[\\w]+)";
let size = "(?<size>[\\d]+)";
let arrayspec = "(?<arrayof>[bw])";
let pointer = "(?<ispointer>[p])";
let arrayof = `${size}${arrayspec}`;

let formalparspec = `${name}/(${registername}|${arrayof}|4)`;

let labelspec = `${name}/(${arrayof}|${pointer})`;
let valuespec = `#(?<value>[\\d]+)`;
let actualparspec = `(${labelspec}|${valuespec})`;

let _getvarreg = s => {
  let gg = s.match(formalparspec).groups;
  if (_.isUndefined(gg.size)) gg.size = 4;
  else gg.size = parseInt(gg.size);
  if (gg.arrayof === "w") gg.size = gg.size * 4;
  return gg;
};

let wrap = (data, c) => {
  return `
\\begin{tikzpicture}[start chain=1 going ${data.stackgrows}, node distance=0mm,
zone/.style={on chain=1, dashed, draw=gray, text centered, text width=3cm, minimum height = 30mm, text=gray},
parameter/.style={on chain=1, dashed, draw=gray, text centered, text width=3cm, minimum height = 10mm, text=gray},
savedreg/.style={on chain=1, draw=black, text centered, text width=3cm, minimum height = 10mm},
localvar/.style={on chain=1, draw=black, text centered, text width=3cm, minimum height = 10mm, fill=blue!10}]
${c}
\\end{tikzpicture}
`;
};

let _n = s => s.replace("$", "\\$");

let gpdiag = (data, cells, stackAlloc) => {
  let txt = _.join(
    _.map(cells, i => {
      let lab = "";
      let cause = "";
      if (!_.isUndefined(i.cause)) {
        cause = `(${i.cause})`;
      }
      if (!_.isUndefined(i.offset) && i.type !== "zone") {
        if (i.offset === 0) lab = `,label=right:{\\$sp + ${i.offset}}`;
        else lab = `,label=right:{${i.offset}}`;
      } else {
        if (i.type === "zone") {
          lab = `,label=right:{\\$sp offset $\\downarrow$}`;
          if (!data.omitFramePointer) {
            lab = lab + `,label=left:{\\$fp offset $\\downarrow$}`;
          }
        }
      }
      if (!data.omitFramePointer && i.type !== "zone") {
        if (i.offset === 0)
          lab = lab + `,label=left:{\\$fp + ${i.offset - stackAlloc + 4}}`;
        else lab = lab + `,label=left:{${i.offset - stackAlloc + 4}}`;
      }
      return `\\node [${i.type}${lab}] {${_n(i.name)} ${cause}};`;
    }),
    "\n"
  );
  return wrap(data, txt);
};

let gpblank = (data, cells) => {
  let txt = _.join(
    _.map(cells, i => {
      let cause = "";
      if (!_.isUndefined(i.cause)) {
        cause = `(${i.cause})`;
      }
      let lab = "";
      if (!_.isUndefined(i.offset) && i.type !== "zone") {
        lab = `,label=right:{\\ldots\\ldots}`;
      } else {
        if (i.type === "zone") {
          lab = `,label=right:{\\$sp offset $\\downarrow$}`;
          if (!data.omitFramePointer) {
            lab = lab + `,label=left:{\\$fp offset $\\downarrow$}`;
          }
        }
      }
      if (!data.omitFramePointer && i.type !== "zone") {
        lab = lab + `,label=left:{\\ldots\\ldots}`;
      }
      if (i.type === "zone")
        return `\\node [${i.type}${lab}] {${_n(i.name)} ${cause}};`;
      else return `\\node [savedreg${lab}] {};`;
    }),
    "\n"
  );
  return wrap(data, txt);
};

let unfoldVariable = (cells, { size, name, arrayof, type }) => {
  if (arrayof === "w") {
    let as = _.range(0, size, 4);
    let rgs = _.map(as, (o, i) => {
      return {
        type,
        name: `${name}[${i}]`,
        size: 4,
        base: i === 0,
        baseOf: name
      };
    });
    _.map(_.reverse(rgs), r => cells.push(r));
  } else {
    if (arrayof === "b") {
      let as = _.range(0, size, 4);
      let rgs = _.reverse(
        _.map(as, (v, i) => {
          return { lb: v, ub: Math.min(v + 3, size - 1), base: i === 0 };
        })
      );
      _.map(rgs, ({ ub, lb, base }) => {
        cells.push({
          type,
          name: `${name}[${ub}..${lb}]`,
          size: 4,
          base,
          baseOf: name
        });
      });
    } else {
      cells.push({
        type,
        name,
        size,
        base: true,
        baseOf: name
      });
    }
  }
};

let gpstate = data => {
  let cee = data.functionData;
  let cells = [];

  cells.push({
    type: "zone",
    name: "caller",
    size: 0,
    cause: "previous frame"
  });

  _.map(cee.parameters, l => {
    let { name, register, size, arrayof } = _getvarreg(l);
    if (!register) {
      unfoldVariable(cells, { name, size, arrayof, type: "parameter" });
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
  if (!cee.isLeaf) {
    cells.push({ type: "savedreg", name: "$ra", size: 4 });
  }

  _.map(cee.localvars, l => {
    let { name, register, size, arrayof } = _getvarreg(l);
    if (register) {
      cells.push({
        type: "savedreg",
        name: register,
        cause: `needed for ${name}`,
        size: 4
      });
    } else {
      unfoldVariable(cells, { name, size, arrayof, type: "localvar" });
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

let developCall = async args => {
  let data = await (args.json ? $fs.readFile(args.json, "utf8") : $gstd());
  data = JSON.parse(data);
  let state = gpstate(data);
  let stackAlloc = _.sum(
    _.map(
      _.filter(state, c => c.type === "savedreg" || c.type === "localvar"),
      "size"
    )
  );
  return { state, data, stackAlloc };
};

let addMain = (data, prog, { parvalues }) => {
  let v = _.map(parvalues, (p, i) => {
    let { ispointer, name, value } = p.match(actualparspec).groups;
    if (ispointer) return `la $a${i}, ${name}`;
    else {
      return `li $a${i}, ${value}`;
    }
  });
  let prepare = _.join(v, "\n");
  let newprog = `${prog}

# main test
main: 
${prepare}
jal ${_.toUpper(data.functionData.name)}
`;
  return beautifyString(newprog);
};

let produceAsm = async ({ data, state, stackAlloc, dirname }) => {
  let cee = data.functionData;
  if (data.functionData.body) {
    let nname = data.functionData.body.replace("$selfdir", dirname);
    data.functionData.body = await $fs.readFile(nname, "utf8");
  } else {
    data.functionData.body = "";
  }
  if (data.functionData.cref) {
    let nname = data.functionData.cref.replace("$selfdir", dirname);
    data.functionData.cref = await $fs.readFile(nname, "utf8");
  } else {
    data.functionData.cref = "no source given";
  }
  let sdata = _.join(
    _.map(data.data, d => {
      if (d.type === "string") return `${d.name}: .asciiz "${d.value}"`;
    }),
    "\n"
  );
  let parameters = _.join(
    _.filter(
      _.map(cee.parameters, l => {
        let { name, register, size } = _getvarreg(l);
        if (register) {
          return `# - register ${register} contains ${name} (${size})`;
        }
      })
    ),
    "\n"
  );
  let labels = _.join(
    _.filter(
      _.map(state, c => {
        if (!_.isUndefined(c.base) && c.base)
          return `# - local var ${_.toUpper(c.baseOf)} at stack offset: ${
            c.offset
          }`;
        if (c.type === "savedreg") {
          return `# - saved reg ${c.name} at stack offset: ${c.offset}`;
        }
        if (c.type === "parameter") {
          return `# - saved reg ${c.name} at stack offset: ${c.offset}`;
        }
        return null;
      })
    ),
    "\n"
  );
  let saveregs = _.join(
    _.filter(
      _.map(state, c => {
        if (c.type === "savedreg") {
          return `sw ${c.name}, ${c.offset}($sp)`;
        }
        return null;
      })
    ),
    "\n"
  );
  let restoreregs = _.join(
    _.filter(
      _.map(state, c => {
        if (c.type === "savedreg") {
          return `lw ${c.name}, ${c.offset}($sp)`;
        }
        return null;
      })
    ),
    "\n"
  );
  let enlargeStack = stackAlloc > 0 ? `addiu $sp, $sp, -${stackAlloc}` : "";
  let shrinkStack = stackAlloc > 0 ? `addiu $sp, $sp, ${stackAlloc}` : "";
  let fname = data.functionData.name;
  let prog = `
# Stack frame information for function '${fname}':
${parameters}
${labels}

# static data 
.data
${sdata}

# function prologue
.text
.globl ${_.toUpper(fname)}
${_.toUpper(fname)}: 
${enlargeStack}
${saveregs}

# function body
${data.functionData.body}

# function epilogue
${_.toUpper(fname + "EPI")}:
${restoreregs}
${shrinkStack}
jr $ra
`;
  return beautifyString(prog);
};

let produceAndSaveArtifacts = async (args, options) => {
  let { state, data, stackAlloc } = await developCall(args, options);
  let diag = gpdiag(data, state, stackAlloc);
  let diagb = gpblank(data, state, stackAlloc);
  let dirname = path.dirname(path.resolve(args.json));
  let asm = await produceAsm({ data, state, stackAlloc, dirname });
  let source = data.functionData.cref;
  let result = {
    latex: [
      latexArtifact(diag, "complete diagram", "standalone", "pdflatex"),
      latexArtifact(diagb, "blank diagram", "standalone", "pdflatex"),
      latexArtifact(
        `
\\begin{minted}{asm}
${asm}
\\end{minted}`,
        "asm source",
        "standalone",
        "pdflatex",
        "--usepackage minted -r varwidth"
      ),
      latexArtifact(
        `
\\begin{minted}{c}
${source}
\\end{minted}`,
        "c source",
        "standalone",
        "pdflatex",
        "--usepackage minted -r varwidth"
      )
    ]
  };
  if (options.save) {
    return saveArtifacts(result, options.save);
  } else {
    console.log(JSON.stringify(result));
  }
};

let main = () => {
  prog
    .description("Function call utils")
    .command("diagram", "generates stack and register usage for a call")
    .argument("[json]", `File describing the call sequence`)
    .option("-j, --json", `print sequence of cells instead of tikz diagram`)
    .option("-b, --blank", `blank diagram`)
    .action(async (args, options) => {
      let { state, data, stackAlloc } = await developCall(args, options);
      if (options.json) {
        console.log({ state, stackAlloc });
      } else {
        if (!options.blank) console.log(gpdiag(data, state, stackAlloc));
        else console.log(gpblank(data, state, stackAlloc));
      }
    })
    .command("asm", "generates asm prologue for callee")
    .argument("<json>", `File describing the call sequence`)
    .action(async (args, options) => {
      let dirname = path.dirname(path.resolve(args.json));
      let { state, data, stackAlloc } = await developCall(args, options);
      console.log(await produceAsm({ data, state, stackAlloc, dirname }));
    })
    .command("test", "invokes function with tests")
    .argument("<json>", `File describing the call sequence`)
    .action(async (args, options) => {
      let dirname = path.dirname(path.resolve(args.json));
      let { state, data, stackAlloc } = await developCall(args, options);
      let asm = await produceAsm({ data, state, stackAlloc, dirname });
      let results = await Promise.all(
        _.map(data.tests, t => {
          return runString(addMain(data, asm, t));
        })
      );
      _.forEach(data.tests, (t, i) => {
        if (results[i].v0 === t.result) {
          console.log(
            chalk.green("OK") + `: Expected ${t.result}, got ${results[i].v0}`
          );
        } else {
          console.log(
            chalk.red("KO") + `: Expected ${t.result}, got ${results[i].v0}`
          );
        }
      });
    })
    .command("artifact", "generates stack and register usage for a call")
    .argument("[json]", `File describing the call sequence`)
    .option(
      "-s, --save <string>",
      "save data with in files with prefix <string>"
    )
    .action(produceAndSaveArtifacts);
  prog.parse(process.argv);
};

main();
