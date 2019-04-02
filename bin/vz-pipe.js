#!/usr/bin/env node
"use strict";

const prog = require("caporal");

let _ = require("lodash");

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
   \\matrix (m) [matrix of nodes,
           row sep=.5mm, 
           column sep=2mm,
           nodes={minimum width=6mm, minimum height=6mm, anchor=center}]{${c}};
\\end{tikzpicture}
`;

let conflictsToTikz = (sim, options) => {
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
  let insttikz = i => {
    let ii = [`|[text width=25mm]|{\\texttt{${i.ins}}}`];
    let remaining = _.map(i.pipe, c => {
      if (!options.blank) {
        if (c === "-") return ``;
        else if (c === "*") return `|[draw]| $\\bullet$`;
        else {
          if (c === "F") return `|[draw]| IM`;
          else if (c === "D" || c === "W") return `|[draw]| REG`;
          else if (c === "E") return `|[draw]| ALU`;
          else return `|[draw]| DM`;
        }
      } else {
        return `|[draw]|`;
      }
    });
    return _.join(_.concat(ii, remaining), " & ") + "\\\\\n";
  };
  let result = {
    code: wrapperc(head + _.join(_.map(sim, insttikz), "")),
    maxClocks
  };
  return result;
};

let hazardToTikz = (sim, options) => {
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
  let insttikz = i => {
    let ii = [`|[text width=25mm]|{\\texttt{${i.ins}}}`];
    let remaining = _.map(i.pipe, c => {
      if (!options.blank) {
        if (c === "-") return `|[draw,fill=gray!20]|`;
        else if (c === "*") return `|[draw]| $\\bullet$`;
        else return `|[draw]| ${c}`;
      } else {
        return `|[draw]|`;
      }
    });
    return _.join(_.concat(ii, remaining), " & ") + "\\\\\n";
  };
  let result = {
    code: wrapper(head + _.join(_.map(sim, insttikz), "")),
    maxClocks
  };
  return result;
};

let load = _.curry((name, d, s1) => {
  return ({ config, readypc, ready, table }) => {
    let canDecodeAt = Math.max(ready[s1], readypc + 1);
    let rdy = _.clone(ready);
    let tbl = _.clone(table);
    tbl.push({
      ins: `${name} r${d}, lab(r${s1})`,
      pipe: pipe(
        readypc,
        canDecodeAt
      )
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

let nop = () => {
  return ({ config, readypc, ready, table }) => {
    let canDecodeAt = Math.max(readypc + 1);
    let rdy = _.clone(ready);
    let tbl = _.clone(table);
    tbl.push({
      ins: `nop`,
      pipe: pipe(
        readypc,
        canDecodeAt
      )
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

let branch = _.curry((name, s1, s2) => {
  return ({ config, readypc, ready, table }) => {
    let canDecodeAt = Math.max(ready[s1], ready[s2], readypc + 1);
    let rdy = _.clone(ready);
    let tbl = _.clone(table);
    tbl.push({
      ins: `${name} r${s1}, r${s2}, offset`,
      pipe: pipe(
        readypc,
        canDecodeAt
      )
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
      ins: `${name} r${d}, r${s1}, r${s2}`,
      pipe: pipe(
        readypc,
        canDecodeAt
      )
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
    ready: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // registrers
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
let beq = branch("beq");

let main = () => {
  prog
    .description("Pipeline visualization generator")
    .argument(
      "<program>",
      `The instructions separated by commas e.g.: 'lw(2, 1),add(4, 2, 5)'`
    )
    .option("-a, --alufw", "Use ALU forwarding")
    .option("-m, --memfw", "Use Mem forwarding")
    .option("--branchpred", "Use branch prediction")
    .option("--branchopt", "Compute the branch sooner")
    .option("-b, --blank", "To fill up")
    .option("-n, --max-cycles <integer>", "Grid size")
    .action((args, options) => {
      let sim = simulate({
        hasAluForwarding: options.alufw,
        hasMemForwarding: options.memfw,
        hasBranchPrediction: options.branchpred,
        hasBranchOptimization: options.branchopt
      })(eval(`[${args.program}]`));
      let results = {
        state: sim,
        table: _.join(_.map(sim.table, "pipe"), "\n"),
        latex: {
          hazard: hazardToTikz(sim.table, options),
          conflicts: conflictsToTikz(sim.table, options)
        }
      };
      console.log(JSON.stringify(results, 0, 4));
    });
  prog.parse(process.argv);
};

main();
