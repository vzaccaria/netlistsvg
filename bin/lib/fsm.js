let _ = require("lodash");
let $fs = require("mz/fs");
let { latexArtifact, saveArtifacts } = require("./artifacts");

let wrap = (c, options) => `
\\begin{tikzpicture}[>=stealth', initial text=$ $]
\\graph[spring layout,
       random seed=${options.randomSeed},
       node distance=${options.nodeDistance}]{
       ${c}
};
\\end{tikzpicture} 
`;

let parseName = n => {
  let regexp = /(?<name>.*)\/(?<lab>[ud\-]?)(b(?<angle>.*))?/;
  if (!_.isNull(n.match(regexp))) {
    let match = n.match(regexp).groups;
    if (!_.isUndefined(match)) {
      let r = { name: match.name };
      r.lab = match.lab !== "" ? match.lab : "u";
      r.angle = match.angle ? match.angle : "30";
      return r;
    } else {
      return { name: n, lab: "u", angle: "30" };
    }
  } else {
    return { name: n, lab: "u", angle: "30" };
  }
};

let loopDir = angle => {
  angle = parseInt(angle);
  return `in=${angle + 60}, out=${angle + 75}, loop`;
};

let getSrcOpts = (fsm, n1) => {
  let ops = ["state"];
  if (fsm.initial === n1) {
    ops = _.concat(ops, ["initial"]);
    if (!_.isUndefined(fsm.initialLabPos))
      ops = _.concat(ops, ["initial where=" + fsm.initialLabPos]);
  }
  return _.join(ops, ",");
};

let connectMealy = (fsm, o1, o2, input) => {
  let _out = q => _.join(_.flatten(_.values(q)), "");
  //  get from { "name: .... } -> "name"
  let _n = q => _.keys(q)[0];
  let n1 = _n(o1);
  let in2 = _n(o2);
  let { name, lab, angle } = parseName(in2);
  let n2 = name;

  let lp = loopDir(angle);

  let type = n1 === n2 ? `${lp}` : `bend left=${angle}`;
  let label = `$${_.join(input, "")}/${_out(o2)}$`;
  return `"$${n1}$" [${getSrcOpts(fsm, n1)}] -> [${type}, edge label${
    lab === "d" ? "'" : ""
  }={\\tiny ${label}}] "$${n2}$" [state]`;
};

let getMooreTransLabel = (fsm, n1, n2, input) => {
  let f = fsm.transLabels;
  if (!_.isUndefined(f) && !_.isUndefined(f[`${n1}/${n2}`])) {
    return f[`${n1}/${n2}`];
  } else {
    return _.join(input, "");
  }
};

let connectMoore = (fsm, o1, o2, input, output) => {
  //  get from { "name: .... } -> "name"
  //
  let _n = q => _.keys(q)[0];
  let n1 = _n(o1);
  let l1 = `${n1}/${_.join(output, "")}`;

  let in2 = o2;
  let { name, lab, angle } = parseName(in2);
  let n2 = name;
  let tnames = _.map(fsm.transitions, _n);
  let o2out = _.join(fsm.output[_.findIndex(tnames, s => s === n2)], "");
  let l2 = `${n2}/${o2out}`;

  let tl = getMooreTransLabel(fsm, n1, n2, input);

  let type = n1 === n2 ? `${loopDir(angle)}` : `bend left=${angle}`;
  let label = `$${tl}$`;
  return `"$${n1}$" [${getSrcOpts(
    fsm,
    n1
  )},as=$${l1}$] -> [${type}, edge label${
    lab === "d" ? "'" : ""
  }={\\tiny ${label}}] "$${n2}$" [state, as=$${l2}$]`;
};

let mealy = fsm => {
  return _.flatten(
    _.map(fsm.transitions, o1 => {
      let o2s = _.flatten(_.values(o1));
      return _.map(fsm.inputs, (i, ni) => {
        return connectMealy(fsm, o1, o2s[ni], i);
      });
    })
  );
};

let moore = fsm => {
  return _.flatten(
    _.map(fsm.transitions, (o1, ns) => {
      let o2s = _.flatten(_.values(o1));
      return _.map(fsm.inputs, (i, ni) => {
        return connectMoore(fsm, o1, o2s[ni], i, fsm.output[ns]);
      });
    })
  );
};

let produceMoore = (fsm, options) => {
  return wrap(_.join(moore(fsm), ",\n"), options);
};

let produceMealy = (fsm, options) => {
  return wrap(_.join(mealy(fsm), ",\n"), options);
};

let drawFSM = (fsm, options) => {
  fsm.inputs = codeWords(fsm.inputSize);
  if (fsm.type === "mealy") return produceMealy(fsm, options);
  else return produceMoore(fsm, options);
};

const f = (a, b) => [].concat(...a.map(d => b.map(e => [].concat(d, e))));

const cartesian = (a, b, ...c) => (b ? cartesian(f(a, b), ...c) : a);

let codeWords = l => {
  return _.map(_.range(0, Math.pow(2, l)), x =>
    _.map(_.padStart(x.toString(2), l, "0").split(""), y => (y === "1" ? 1 : 0))
  );
};

let dumpEx = m => {
  $fs.readFile(`${__dirname}/fixtures/${m}.json`, "utf8").then(console.log);
};

let getTransitionTable = fsm => {
  if (fsm.type === "mealy") {
    return Object.assign(
      ..._.map(fsm.transitions, v => {
        let ls = _.flatten(_.values(v));
        let state = _.keys(v)[0];
        let o = {};
        o[state] = _.map(ls, e => {
          let { name } = parseName(_.keys(e)[0]);
          return name;
        });
        return o;
      })
    );
  } else {
    return Object.assign(
      ..._.map(fsm.transitions, v => {
        let ls = _.flatten(_.values(v));
        let state = _.keys(v)[0];
        let o = {};
        o[state] = _.map(ls, e => {
          let { name } = parseName(e);
          return name;
        });
        return o;
      })
    );
  }
};

let trans = (fsm, s, i) => {
  if (_.isUndefined(fsm.encoding)) throw "undefined encoding!";
  if (i.length !== fsm.inputSize) throw "wrong input size!";
  let stateName = _.findKey(fsm.encoding, v => {
    return _.isEqual(v, s);
  });
  let undef = _.map(_.repeat("x", fsm.encodingSize));
  if (_.isUndefined(stateName)) return undef;
  else {
    let inputEncoding = parseInt(_.join(i, ""), 2);
    let ttable = getTransitionTable(fsm);
    return fsm.encoding[ttable[stateName][inputEncoding]];
  }
};

let tableWrap = c => `
\\begin{table}
        \\newcommand{\\head}[1]{{\\textbf{#1}}}
                ${c}
\\end{table}
`;

let tableHead = headings => `\\begin{tabular}{${_.repeat("c", headings.length)}}
${_.join(_.map(headings, t => "\\head{$" + t + "$}"), " & ")} \\\\
`;

let tail = `
        \\end{tabular}`;

let tableRow = row => `${_.join(row, " & ")} \\\\`;

let latexTruth = (table, headings) => {
  return tableWrap(`
        ${tableHead(headings)}
        ${_.join(_.map(table, tableRow), "\n")}
        ${tail}
        `);
};
let synthesizeD = (fsm, options) => {
  let diagram = drawFSM(fsm, options);

  let inoutcomb = cartesian(
    codeWords(fsm.encodingSize),
    codeWords(fsm.inputSize)
  );
  let excitationTable = _.map(inoutcomb, vs => {
    let ss = _.take(vs, fsm.encodingSize);
    let ii = _.takeRight(vs, fsm.inputSize);
    return _.concat(ss, ii, trans(fsm, ss, ii));
  });
  let headings = _.concat(
    _.map(_.range(0, fsm.encodingSize), i => `Q_${i}`),
    _.map(_.range(0, fsm.inputSize), i => `I_${i}`),
    _.map(_.range(0, fsm.encodingSize), i => `D_${i}`)
  );
  excitationTable = latexTruth(excitationTable, headings);
  return { diagram, excitationTable };
};

let formatResults = ({ diagram, excitationTable }) => {
  return [
    latexArtifact(diagram, "diagram", "standalone", "lualatex", "-z automata"),
    latexArtifact(excitationTable, "excitation table", "standalone", "pdflatex", "-r varwidth")
  ];
};

let elaborateFSM = (fsm, options) => {
  if (options.draw) {
    console.log(drawFSM(fsm, options));
    return;
  } else {
    let data = { latex: formatResults(synthesizeD(fsm, options)) };
    if (options.save) {
      return saveArtifacts(data.latex, options.save);
    } else {
      console.log(JSON.stringify(data));
    }
  }
};

module.exports = { elaborateFSM, dumpEx };
