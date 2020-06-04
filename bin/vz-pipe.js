#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const { latexArtifact, saveArtifacts } = require("./lib/artifacts");

let _ = require("lodash");
let $fs = require("mz/fs");

let pipe = (ft, dc) => {
  return _.repeat("-", ft) + "F" + _.repeat("*", dc - ft - 1) + "DEMW";
};

let wrapper = c => `
\\begin{tikzpicture}
   \\matrix (m) [matrix of nodes,
           row sep=.5mm, 
           column sep=.5mm,
           nodes={minimum width=6mm, minimum height=6mm, anchor=center}]{${c}};
\\end{tikzpicture}
`;

let wrapperc = c => `
\\begin{tikzpicture}
${c}
\\end{tikzpicture}
`;

let asmCode = sim => {
  return `
\\begin{minted}{asm}
${_.join(_.map(sim, i => i.ins), "\n")}
\\end{minted}`;
};

let hazardsToTikz = (sim, options) => {
  let insttikz = (i, n) => {
    let pi = 2 + n * 1.5;
    let pj = -1 * n * options.hrowsep;
    let ii = [
      options.noInstructions
        ? ""
        : `\\node at (0, ${pj}) [align=left, text width=25mm] {\\footnotesize\\texttt{${
            i.ins
          }}};`,
      `\\pic (i${n}) at (${pi}, ${pj}) {pipe};`
    ];

    return ii;
  };
  let tikzconflicts = options.conflicts
    ? _.join(_.map(options.conflicts.split(","), dep), "\n")
    : "";
  let result = {
    complete: wrapperc(
      _.join(_.flatten(_.map(sim, insttikz)), "\n") + "\n" + tikzconflicts
    ),
    blank: wrapperc(_.join(_.flatten(_.map(sim, insttikz)), "\n"))
  };
  return result;
};

let insttikz = _.curry((blank, i) => {
  let ii = [`|[text width=25mm]|{\\footnotesize\\texttt{${i.ins}}}`];
  let remaining = _.map(i.pipe, c => {
    if (!blank) {
      if (c === "-") return `|[draw,fill=gray!20]|`;
      else if (c === "*") return `|[draw]| $\\bullet$`;
      else return `|[draw]| ${c}`;
    } else {
      return `|[draw]|`;
    }
  });
  return _.join(_.concat(ii, remaining), " & ") + "\\\\\n";
});

let dep = c => {
  let regexp = /(?<type>.)(?<froms>.)(?<fromi>[0-9]+)(?<tos>.)(?<toi>[0-9]+)/;
  let { type, froms, fromi, tos, toi } = c.match(regexp).groups;
  if (type === "d" || type === "c") {
    return `\\draw [-stealth', thick, ${
      type === "d" ? "green" : "red"
    }] (i${fromi}-${froms}) -- (i${toi}-${tos});`;
  } else {
    if (tos === "e") tos = "e.pia";
    return `\\draw [-stealth', thick, blue] (i${fromi}-f${froms}) -- (i${toi}-${tos});`;
  }
};

let pipeSimulatorTikz = (sim, options) => {
  let maxClocks = _.max(_.map(sim, i => i.pipe.length));
  if (options.maxCycles)
    maxClocks = maxClocks > options.maxCycles ? maxClocks : options.maxCycles;
  let head = [
    `|[align=right, text width=25mm]|  {\\tiny clock cycle $\\rightarrow$}`
  ];
  head = _.concat(head, _.range(0, maxClocks));
  head = _.join(head, " & ") + "\\\\\n";
  let fixLength = i => {
    i.pipe = _.padEnd(i.pipe, maxClocks, "-");
    return i;
  };
  sim = _.map(sim, fixLength);
  let result = {
    complete: wrapper(head + _.join(_.map(sim, insttikz(false)), "")),
    blank: wrapper(head + _.join(_.map(sim, insttikz(true)), "")),
    maxClocks
  };
  return result;
};

let store = _.curry((name, s1, s2) => {
  return ({ config, readypc, ready, table }) => {
    let canDecodeAt = Math.max(ready[s1], ready[s2], readypc + 1);
    let rdy = _.clone(ready);
    let tbl = _.clone(table);
    tbl.push({
      ins: `${name} x${s1}, lab(x${s2})`,
      pipe: pipe(
        readypc,
        canDecodeAt
      ),
      canDecodeAt
    });
    let nextState = {
      readypc: canDecodeAt,
      ready: rdy,
      table: tbl,
      config
    };
    return nextState;
  };
});

let load = _.curry((name, d, s1) => {
  return ({ config, readypc, ready, table }) => {
    let canDecodeAt = Math.max(ready[s1], readypc + 1);
    let rdy = _.clone(ready);
    let tbl = _.clone(table);
    tbl.push({
      ins: `${name} x${d}, lab(x${s1})`,
      pipe: pipe(
        readypc,
        canDecodeAt
      ),
      canDecodeAt
    });
    rdy[d] = canDecodeAt + (config.hasMemForwarding ? 2 : 3);
    let nextState = {
      readypc: canDecodeAt,
      ready: rdy,
      table: tbl,
      config
    };
    return nextState;
  };
});

let other = name => () => {
  return ({ config, readypc, ready, table }) => {
    let canDecodeAt = Math.max(readypc + 1);
    let rdy = _.clone(ready);
    let tbl = _.clone(table);
    tbl.push({
      ins: name,
      pipe: pipe(
        readypc,
        canDecodeAt
      ),
      canDecodeAt
    });
    let nextState = {
      readypc: canDecodeAt,
      ready: rdy,
      table: tbl,
      config
    };
    return nextState;
  };
};

let nop = other("nop");

let anything = other("...");

let branch = _.curry((name, s1, s2) => {
  return ({ config, readypc, ready, table }) => {
    let o = config.hasBranchOptimization && config.hasAluForwarding;
    let canDecodeAt = Math.max(
      o ? ready[s1] + 1 : ready[s1],
      o ? ready[s2] + 1 : ready[s2],
      readypc + 1
    );
    let rdy = _.clone(ready);
    let tbl = _.clone(table);
    tbl.push({
      ins: `${name} x${s1}, x${s2}, lab`,
      pipe: pipe(
        readypc,
        canDecodeAt
      ),
      canDecodeAt
    });
    readypc =
      canDecodeAt +
      (config.hasBranchPrediction ? 0 : config.hasBranchOptimization ? 1 : 3);
    let nextState = {
      readypc: readypc,
      ready: rdy,
      table: tbl,
      config
    };
    return nextState;
  };
});

let alu = _.curry((name, d, s1, s2) => {
  return ({ config, readypc, ready, table }) => {
    let canDecodeAt = Math.max(ready[s1], ready[s2], readypc + 1);
    let rdy = _.clone(ready);
    let tbl = _.clone(table);
    tbl.push({
      ins: `${name} x${d}, x${s1}, x${s2}`,
      pipe: pipe(
        readypc,
        canDecodeAt
      ),
      canDecodeAt
    });
    rdy[d] = canDecodeAt + (config.hasAluForwarding ? 1 : 3);
    let nextState = {
      readypc: canDecodeAt,
      ready: rdy,
      table: tbl,
      config
    };
    return nextState;
  };
});

let simulate = config => {
  let initialState = {
    ready: [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ], // registrers
    readypc: 0,
    table: [],
    config
  };

  let run = program => {
    return _.reduce(program, (s, i) => i(s), initialState);
  };
  return run;
};

let add = alu("add");
let sub = alu("sub");
let or = alu("or");
let lw = load("lw");
let sw = store("sw");
let beq = branch("beq");

let main = () => {
  prog
    .description("Pipeline visualization generator")
    .command("pipesim")
    .argument(
      "<program>",
      `The instructions separated by commas e.g.: 'lw(2, 1),add(4, 2, 5)'`
    )
    .option("-s, --save <prefix>", "save with prefix or dump json")
    .option("-a, --alufw", "Use ALU forwarding")
    .option("-m, --memfw", "Use Mem forwarding")
    .option("--branchpred", "Use branch prediction")
    .option("--branchopt", "Compute the branch sooner")
    .option("-b, --blank", "To fill up")
    .option("-o, --no-instructions", "Don't show instructions")
    .option("-n, --max-cycles <integer>", "Grid size")
    .option("-c, --conflicts <string>", "Conflicts strings (comma separated)")
    .option(
      "--hrowsep <double>",
      "Hazard tikz row separation",
      prog.DOUBLE,
      1.3
    )
    .action((args, options) => {
      let sim = simulate({
        hasAluForwarding: options.alufw,
        hasMemForwarding: options.memfw,
        hasBranchPrediction: options.branchpred,
        hasBranchOptimization: options.branchopt
      })(eval(`[${args.program}]`));
      let ps = pipeSimulatorTikz(sim.table, options);
      let hz = hazardsToTikz(sim.table, options);
      let results = {
        state: sim,
        table: _.join(_.map(sim.table, "pipe"), "\n"),
        latex: [
          latexArtifact(
            ps.complete,
            "pipe sim complete",
            "standalone",
            "pdflatex",
            "-r varwidth"
          ),
          latexArtifact(
            ps.blank,
            "pipe sim blank",
            "standalone",
            "pdflatex",
            "-r varwidth"
          ),
          latexArtifact(
            hz.complete,
            "pipe hazards complete",
            "standalone",
            "pdflatex",
            `-r varwidth -i ${__dirname}/preambles/pipe.tex`
          ),
          latexArtifact(
            hz.blank,
            "pipe hazards blank",
            "standalone",
            "pdflatex",
            `-r varwidth -i ${__dirname}/preambles/pipe.tex`
          ),
          latexArtifact(
            asmCode(sim.table, options),
            "asm code",
            "standalone",
            "pdflatex",
            "--usepackage minted -r varwidth"
          )
        ]
      };
      if (!options.save) {
        console.log(JSON.stringify(results, 0, 4));
      } else {
        saveArtifacts(results.latex, options.save);
      }
    })
    .command("preamble", "Print latex preamble")
    .action(args => {
      $fs.readFile(`${__dirname}/preambles/pipe.tex`, "utf8").then(console.log);
    });
  prog.parse(process.argv);
};

main();
