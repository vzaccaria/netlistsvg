#!/usr/bin/env node
"use strict";

const prog = require("caporal");
// const { execWithStringStdErr } = require("./lib/common");
const sprintf = require("sprintf-js").sprintf;
let { exec } = require("mz/child_process");
let $gstd = require("get-stdin");
const _ = require("lodash");
const { beautifyString } = require("./lib/spim");
const path = require("path");
let { latexArtifact, saveArtifacts } = require("./lib/artifacts");

let $fs = require("mz/fs");

let name = "(?<name>[\\w[\\.\\]]+)";
let registername = "(?<register>\\$[\\w]+)";
let size = "(?<size>[\\d]+)";
let arrayspec = "(?<arrayof>[bw])";
let arrayof = `${size}${arrayspec}`;

let formalparspec = `${name}/(${registername}|${arrayof}|w)`;

let _getvarreg = s => {
  let gg = s.match(formalparspec).groups;
  if (_.isUndefined(gg.size)) gg.size = 8;
  else gg.size = parseInt(gg.size);
  if (gg.arrayof === "w") gg.size = gg.size * 8;
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

let gpdiag = (data, cells, stackAlloc, full) => {
  let txt = _.join(
    _.filter(
      _.flatten(
        _.map(cells, (i, x) => {
          let lab = "";
          let labsp = "";
          let cause = "";
          let labfp = undefined;
          let type = i.type;
          if (!_.isUndefined(i.cause)) {
            cause = `(${i.cause})`;
          }
          if (full) {
            if (!_.isUndefined(i.offset) && i.type !== "zone") {
              if (i.offset === 0) labsp = `sp + ${i.offset}`;
              else labsp = `${i.offset}`;
            } else {
              if (i.type === "zone") {
                labsp = `sp offset`;
                if (!data.omitFramePointer) {
                  labfp = `fp offset`;
                }
              }
            }
            if (!data.omitFramePointer && i.type !== "zone") {
              if (i.offset === 0) labfp = `fp + ${i.offset - stackAlloc + 8}`;
              else labfp = `${i.offset - stackAlloc + 8}`;
            }
            lab = `${_n(i.name)} ${cause}`;
          } else {
            cause = i.type === "zone" ? i.cause : "";
            type = i.type === "zone" ? "zone" : "savedreg";
            labsp = "\\ldots";
            labfp = !data.omitFramePointer ? "\\ldots" : undefined;
            lab = i.type === "zone" ? `${_n(i.name)} ${cause}` : "";
          }
          return [
            `\\node (dd${x}) [${type}] {${lab}};`,
            `\\node at ($ (dd${x}) + (1.7,0) $) [anchor=west] {${labsp}};`,
            labfp
              ? `\\node at ($ (dd${x}) + (-1.7,0) $) [anchor=east] {${labfp}};`
              : undefined
          ];
        })
      )
    ),
    "\n"
  );
  return wrap(data, txt);
};

let unfoldVariable = (cells, { size, name, arrayof, type }) => {
  if (arrayof === "w") {
    let as = _.range(0, size, 8);
    let rgs = _.map(as, (o, i) => {
      return {
        type,
        name: `${name}[${i}]`,
        size: 8,
        base: i === 0,
        baseOf: name
      };
    });
    _.map(_.reverse(rgs), r => cells.push(r));
  } else {
    if (arrayof === "b") {
      let as = _.range(0, size, 8);
      let rgs = _.reverse(
        _.map(as, (v, i) => {
          return { lb: v, ub: Math.min(v + 7, size - 1), base: i === 0 };
        })
      );
      _.map(rgs, ({ ub, lb, base }) => {
        cells.push({
          type,
          name: `${name}[${ub}..${lb}]`,
          size: 8,
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
    name: "chiamante",
    size: 0,
    cause: "record precedente"
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
      name: "fp",
      pointedBy: "fp",
      size: 8,
      cause: "valore precedente"
    });
  }

  /* Allocate space on the stack for local variables */
  if (!cee.isLeaf) {
    cells.push({ type: "savedreg", name: "ra", size: 8 });
  }

  _.map(cee.localvars, l => {
    let { name, register, size, arrayof } = _getvarreg(l);
    if (register) {
      cells.push({
        type: "savedreg",
        name: register.substr(1),
        cause: `reclamato per ${name}`,
        size: 8
      });
    } else {
      unfoldVariable(cells, { name, size, arrayof, type: "localvar" });
    }
  });
  cells[cells.length - 1].pointedBy = "sp";

  let overallsize = _.sum(_.map(cells, "size"));
  let offset = overallsize - 8;
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

let produceBlankTable = async ({ data, state }) => {
  let cee = data.functionData;
  let parameters = _.join(
    _.filter(
      _.map(cee.parameters, l => {
        let { name, register, size } = _getvarreg(l);
        if (register) {
          return `- parametro ${name} (dimensione ${size} bytes) nel registro: _____`;
        }
      })
    ),
    "\n"
  );
  let labels = _.join(
    _.filter(
      _.map(state, c => {
        if (!_.isUndefined(c.base) && c.base && c.type !== "parameter")
          return `- spiazzamento sp variabile locale ${c.baseOf} : _____ `;
        if (c.type === "savedreg") {
          return `- spiazzamento sp salvataggio di ${c.name}: _____`;
        }
        if (c.type === "parameter") {
          return `- spiazzamento sp parametro ${c.name} : _____`;
        }
        return null;
      })
    ),
    "\n"
  );
  return `
${parameters}
${labels}
  `;
};

let produceAsm = async ({ data, state, stackAlloc, dirname }, withBody) => {
  let cee = data.functionData;
  if (data.functionData.body && withBody) {
    let nname = data.functionData.body.replace("$selfdir", dirname);
    data.functionData.bodycontent = await $fs.readFile(nname, "utf8");
  } else {
    data.functionData.bodycontent = "";
  }
  if (data.functionData.cref) {
    let nname = data.functionData.cref.replace("$selfdir", dirname);
    data.functionData.crefcontent = await $fs.readFile(nname, "utf8");
  } else {
    data.functionData.crefcontent = "no source given";
  }
  let parameters = _.join(
    _.filter(
      _.map(cee.parameters, l => {
        let { name, register, size } = _getvarreg(l);
        if (register) {
          return `# - register ${register.substr(
            1
          )} contains ${name} (size: ${size} bytes)`;
        }
      })
    ),
    "\n"
  );
  let labels = _.join(
    _.filter(
      _.map(state, c => {
        if (!_.isUndefined(c.base) && c.base && c.type !== "parameter")
          return `# - local var ${c.baseOf} at stack offset: ${c.offset}`;
        if (c.type === "savedreg") {
          return `# - saved reg ${c.name} at stack offset: ${c.offset}`;
        }
        if (c.type === "parameter") {
          return `# - parameter ${c.name} at stack offset: ${c.offset}`;
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
          return `sd ${c.name}, ${c.offset}(sp)`;
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
          return `ld ${c.name}, ${c.offset}(sp)`;
        }
        return null;
      })
    ),
    "\n"
  );
  let enlargeStack = stackAlloc > 0 ? `addi sp, sp, -${stackAlloc}` : "";
  let shrinkStack = stackAlloc > 0 ? `addi sp, sp, ${stackAlloc}` : "";
  let fname = data.functionData.name;
  let prog = `
# Stack frame information for function '${fname}':
${parameters}
${labels}


# function prologue
.text
.globl ${fname}
${fname}: 
${enlargeStack}
${saveregs}

# function body
${data.functionData.bodycontent}

# function epilogue
${fname + "EPI"}:
${restoreregs}
${shrinkStack}
ret
`;
  return beautifyString(prog);
};

let produceAndSaveArtifacts = async (args, options) => {
  let { state, data, stackAlloc } = await developCall(args, options);
  let diag = gpdiag(data, state, stackAlloc, true);
  let diagb = gpdiag(data, state, stackAlloc, false);
  let dirname = path.dirname(path.resolve(args.json));
  let asmFull = await produceAsm({ data, state, stackAlloc, dirname }, true);
  let asmEmpty = await produceAsm({ data, state, stackAlloc, dirname }, false);
  let blankTable = await produceBlankTable({
    data,
    state,
    stackAlloc,
    dirname
  });
  let source = data.functionData.crefcontent;
  let result = {
    latex: [
      latexArtifact(diag, "complete diagram", "standalone", "pdflatex"),
      latexArtifact(diagb, "blank diagram", "standalone", "pdflatex"),
      latexArtifact(
        `
\\begin{minted}[obeytabs=true,autogobble,baselinestretch=0.95,linenos=true]{asm}
${asmFull}
\\end{minted}`,
        "asm source full",
        "standalone",
        "pdflatex",
        "--usepackage minted -r varwidth"
      ),
      latexArtifact(
        `
\\begin{minted}[obeytabs=true,autogobble,baselinestretch=0.95,linenos=true]{asm}
${asmEmpty}
\\end{minted}`,
        "asm source empty",
        "standalone",
        "pdflatex",
        "--usepackage minted -r varwidth"
      ),
      latexArtifact(
        `
\\begin{verbatim}
${blankTable}
\\end{verbatim}`,
        "blank table",
        "standalone",
        "pdflatex",
        "-r varwidth"
      ),
      latexArtifact(
        `
\\begin{minted}[obeytabs=true,autogobble,baselinestretch=0.95,linenos=true]{c}
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
    return saveArtifacts(result.latex, options.save);
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
        if (!options.blank) console.log(gpdiag(data, state, stackAlloc), true);
        else console.log(gpdiag(data, state, stackAlloc, false));
      }
    })
    .command("asm", "generates asm prologue for callee")
    .argument("<json>", `File describing the call sequence`)
    .action(async (args, options) => {
      let dirname = path.dirname(path.resolve(args.json));
      let { state, data, stackAlloc } = await developCall(args, options);
      console.log(await produceAsm({ data, state, stackAlloc, dirname }, true));
    })
    .command("test", "invokes function with tests")
    .argument("<json>", `File describing the call sequence`)
    .option(
      "--cc <format>",
      "Format string to compile test",
      prog.STRING,
      "docker run -v %s:/root/local -w /root/local --rm --entrypoint '/opt/riscv/toolchain/bin/riscv64-unknown-elf-gcc' riscenv-latest %s"
    )
    .option(
      "--run <format>",
      "Format string to invoke test",
      prog.STRING,
      "docker run -v %s:/root/local -w /root/local --rm --entrypoint '/usr/local/bin/rv-sim' riscenv-latest %s"
    )
    .option("--log", "Log instructions and operands")

    .action(async (args, options, logger) => {
      let dirname = path.dirname(path.resolve(args.json));
      let volume = dirname;
      let { state, data, stackAlloc } = await developCall(args, options);
      let asm = await produceAsm({ data, state, stackAlloc, dirname }, true);
      let remoteSuffix = data.functionData.suffix.replace(
        "$selfdir",
        "/root/local"
      );
      let localSuffix = data.functionData.suffix.replace("$selfdir", dirname);
      let fullName = `${remoteSuffix}-full.s`;
      let fullLocalName = `${localSuffix}-full.s`;
      let fullTestName = `${remoteSuffix}-test.c`;
      let fullOutputName = `${remoteSuffix}-test.exe`;
      await $fs.writeFile(fullLocalName, asm, "utf8");
      let compileExe = sprintf(
        options.cc,
        volume,
        `${fullName} ${fullTestName} -o ${fullOutputName}`
      );
      let runExe = sprintf(options.run, volume, fullOutputName);
      logger.debug(compileExe);
      console.log(_.join(await exec(compileExe), ""));
      logger.debug(runExe);
      if (options.log) {
        runExe = `${runExe} --log-instructions --log-operands`;
      }
      console.log(_.join(await exec(runExe), ""));
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
