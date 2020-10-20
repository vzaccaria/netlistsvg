#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const { latexArtifact, saveArtifacts } = require("./lib/artifacts");

let _ = require("lodash");
let $fs = require("mz/fs");

let pipe = ({ n_fe, n_de, n_ee, n_me, n_we }) => {
  let prologue = _.repeat("-", n_fe);
  let ftch = _.repeat("f", n_de - n_fe - 1) + "F";
  let decode = _.repeat("d", n_ee - n_de - 1) + "D";
  let remaining = "EMW";
  return prologue + ftch + decode + remaining;
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
      else if (c === "f") return `|[draw,color=gray!50]| F`;
      else if (c === "d") return `|[draw,color=gray!50]| D`;
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
  return ({ config, ready, table }) => {
    let isAluFw = config.hasAluForwarding;
    let isMemFw = config.hasMemForwarding;
    let n_fe = ready[de];
    let n_de = Math.max(ready[ee], n_fe + 1, ready[pc] + 1);
    let rs1 = isMemFw ? ready[s1] : ready[s1] + 1;
    let rs2 = isAluFw ? ready[s2] : ready[s2] + 1;
    let n_ee = Math.max(ready[me], n_de + 1, rs1, rs2);
    let n_me = Math.max(ready[we], n_ee + 1);
    let n_we = n_me + 1;
    let n_pc = n_fe + 1;
    let ins = `${name} x${s1}, lab(x${s2})`;
    return prepareNewState(
      { name, d: 0, s1, s2, config, ready, table, ins },
      { n_fe, n_de, n_ee, n_me, n_we, n_pc, n_rdd: 0 }
    );
  };
});

let load = _.curry((name, d, s1) => {
  return ({ config, ready, table }) => {
    let isAluFw = config.hasAluForwarding;
    let n_fe = ready[de];
    let n_de = Math.max(ready[ee], n_fe + 1, ready[pc] + 1);
    let n_ee = isAluFw
      ? Math.max(ready[me], n_de + 1, ready[s1])
      : Math.max(ready[me], n_de + 1, ready[s1] + 1);
    let n_me = Math.max(ready[we], n_ee + 1);
    let n_we = n_me + 1;
    let n_pc = n_fe + 1;
    let n_rdd = n_we;
    let ins = `${name} x${d}, lab(x${s1})`;
    return prepareNewState(
      { name, d, s1, s2: 0, config, ready, table, ins },
      { n_fe, n_de, n_ee, n_me, n_we, n_pc, n_rdd }
    );
  };
});

let other = name => () => {
  return ({ config, ready, table }) => {
    let n_fe = ready[de];
    let n_de = Math.max(ready[ee], n_fe + 1, ready[pc] + 1);
    let n_ee = Math.max(ready[me], n_de + 1);
    let n_me = Math.max(ready[we], n_ee + 1);
    let n_we = n_me + 1;
    let n_pc = n_fe + 1;
    let ins = `other ${name}`;
    return prepareNewState(
      { name, d: 0, s1: 0, s2: 0, config, ready, table, ins },
      { n_fe, n_de, n_ee, n_me, n_we, n_pc, n_rdd: 0 }
    );
  };
};

let nop = other("nop");

let anything = other("...");

let alu = _.curry((name, d, s1, s2) => {
  return ({ config, ready, table }) => {
    let isAluFw = config.hasAluForwarding;
    let n_fe = ready[de];
    let n_de = Math.max(ready[ee], n_fe + 1, ready[pc] + 1);
    let n_ee = isAluFw
      ? Math.max(ready[me], n_de + 1, ready[s1], ready[s2])
      : Math.max(ready[me], n_de + 1, ready[s1] + 1, ready[s2] + 1);
    let n_me = Math.max(ready[we], n_ee + 1);
    let n_we = n_me + 1;
    let n_pc = n_fe + 1;
    let n_rdd = isAluFw ? n_me : n_we;
    let ins = `${name} x${d}, x${s1}, x${s2}`;
    return prepareNewState(
      { name, d, s1, s2, config, ready, table, ins },
      { n_fe, n_de, n_ee, n_me, n_we, n_pc, n_rdd }
    );
  };
});

let branch = _.curry((name, s1, s2) => {
  return ({ config, ready, table }) => {
    let isAluFw = config.hasAluForwarding;
    let isBranchOpt = config.hasBranchOptimization;
    let n_fe = ready[de];
    let n_de = Math.max(ready[ee], n_fe + 1, ready[pc] + 1);
    let n_ee;
    if (!isBranchOpt) {
      n_ee = isAluFw
        ? Math.max(ready[me], n_de + 1, ready[s1], ready[s2])
        : Math.max(ready[me], n_de + 1, ready[s1] + 1, ready[s2] + 1);
    } else {
      n_ee = Math.max(ready[me], n_de + 1, ready[s1] + 1, ready[s2] + 1); // regs must be read in the decode stage
    }
    let n_me = Math.max(ready[we], n_ee + 1);
    let n_we = n_me + 1;
    let n_pc = isBranchOpt ? n_ee : n_we;
    let ins = `${name} x${s1}, x${s2}, lab`;
    return prepareNewState(
      { name, d: 0, s1, s2, config, ready, table, ins },
      { n_fe, n_de, n_ee, n_me, n_we, n_pc, n_rdd: 0 }
    );
  };
});

let prepareNewState = (
  { name, d, s1, s2, config, ready, table, ins },
  { n_fe, n_de, n_ee, n_me, n_we, n_pc, n_rdd }
) => {
  let rdy = _.clone(ready);
  rdy[d] = n_rdd;
  rdy[fe] = n_fe;
  rdy[de] = n_de;
  rdy[ee] = n_ee;
  rdy[me] = n_me;
  rdy[we] = n_we;
  rdy[pc] = n_pc;
  // x0 is always ready
  rdy[0] = 0;
  let tbl = _.clone(table);
  tbl.push({
    ins,
    n_fe,
    n_de,
    n_ee,
    n_me,
    n_we,
    src1: ready[s1],
    src2: ready[s2],
    dest: rdy[d],
    n_pc,
    s1,
    s2,
    d,
    pipe: pipe({ n_fe, n_de, n_ee, n_me, n_we })
  });
  let nextState = {
    ready: rdy,
    table: tbl,
    config
  };
  return nextState;
};

// pc ready
const pc = 32;
// stage entry time bookkeeping, e.g. ready[fe] = ready to enter fetch
const fe = 33;
const de = 34;
const ee = 35;
const me = 36;
const we = 37;

let simulate = config => {
  let ready = _.range(0, 38, 0);
  ready[fe] = -1;
  ready[de] = 0;
  ready[ee] = 1;
  ready[me] = 2;
  ready[we] = 3;
  ready[pc] = 0;
  let initialState = {
    ready,
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
    .action(() => {
      $fs.readFile(`${__dirname}/preambles/pipe.tex`, "utf8").then(console.log);
    });
  prog.parse(process.argv);
};

main();
