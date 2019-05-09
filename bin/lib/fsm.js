let _ = require("lodash");
let $fs = require("mz/fs");
let { latexArtifact, saveArtifacts } = require("./artifacts");
let { quickSynth } = require("./quine");

let wrap = (c, options) => `
\\begin{tikzpicture}[>=stealth', initial text=$ $]
\\graph[spring layout,
       random seed=${options.randomSeed},
       node distance=${options.nodeDistance}]{
       ${c}
};
\\end{tikzpicture} 
`;

let getTransStateName = q => _.keys(q)[0];

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

let labelcmd = (lab, label) => {
  if (lab === "c") {
    return `edge node={node [] {\\tiny ${label}}}`;
  } else {
    if (lab === "d") {
      return `edge node={node [auto] {\\tiny${label}}}`;
    } else return `edge node={node [auto, swap] {\\tiny${label}}}`;
  }
};

let connectMealy = (fsm, o1, o2, input) => {
  let _out = q => _.join(_.flatten(_.values(q)), "");
  //  get from { "name: .... } -> "name"
  let n1 = getTransStateName(o1);
  let in2 = getTransStateName(o2);
  let { name, lab, angle } = parseName(in2);
  let n2 = name;

  let lp = loopDir(angle);

  let type = n1 === n2 ? `${lp}` : `bend left=${angle}`;
  let label = `$${_.join(input, "")}/${_out(o2)}$`;
  return `"$${n1}$" [${getSrcOpts(fsm, n1)}] -> [${type}, ${labelcmd(
    lab,
    label
  )}] "$${n2}$" [state]`;
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
  let n1 = getTransStateName(o1);
  let l1 = `${n1}/${_.join(output, "")}`;

  let in2 = o2;
  let { name, lab, angle } = parseName(in2);
  let n2 = name;
  let tnames = _.map(fsm.transitions, getTransStateName);
  let o2out = _.join(fsm.output[_.findIndex(tnames, s => s === n2)], "");
  let l2 = `${n2}/${o2out}`;

  let tl = getMooreTransLabel(fsm, n1, n2, input);

  let type = n1 === n2 ? `${loopDir(angle)}` : `bend left=${angle}`;
  let label = `$${tl}$`;
  return `"$${n1}$" [${getSrcOpts(fsm, n1)},as=$${l1}$] -> [${type}, ${labelcmd(
    lab,
    label
  )} ] "$${n2}$" [state, as=$${l2}$]`;
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

let getTransition = (fsm, t) => {
  let ls = _.flatten(_.values(t));
  let curState = _.keys(t)[0];
  let nextStates = _.map(ls, e => {
    let { name } =
      fsm.type === "mealy" ? parseName(_.keys(e)[0]) : parseName(e);
    return name;
  });
  return { curState, nextStates };
};

let getTransitionTable = fsm => {
  return Object.assign(
    ..._.map(fsm.transitions, t => {
      let { curState, nextStates } = getTransition(fsm, t);
      let o = {};
      o[curState] = nextStates;
      return o;
    })
  );
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

let _rep = (c, n) => {
  return _.map(_.range(0, n), () => c);
};

let stateIndexFromName = (fsm, stateName) => {
  let tnames = _.map(fsm.transitions, getTransStateName);
  return _.findIndex(tnames, s => s === stateName);
};

//
let outfunmoore = (fsm, s) => {
  if (_.isUndefined(fsm.encoding)) throw "undefined encoding!";
  let stateName = _.findKey(fsm.encoding, v => {
    return _.isEqual(v, s);
  });
  let undef = _.map(_.repeat("x", fsm.outputSize));
  if (_.isUndefined(stateName)) return undef;
  let idx = stateIndexFromName(fsm, stateName);
  return fsm.output[idx];
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

let transJK = (fsm, s, i) => {
  let encodings = trans(fsm, s, i);
  return _.flatten(
    _.map(encodings, (qtp1, eidx) => {
      let qt = s[eidx];
      if (qt === 0 && qtp1 === 0) return ["0", "x"];
      if (qt === 0 && qtp1 === 1) return ["1", "x"];
      if (qt === 1 && qtp1 === 0) return ["x", "1"];
      if (qt === 1 && qtp1 === 1) return ["x", "0"];
      if (qtp1 === "x") return ["x", "x"];
    })
  );
};

let transT = (fsm, s, i) => {
  let encodings = trans(fsm, s, i);
  return _.flatten(
    _.map(encodings, (qtp1, eidx) => {
      let qt = s[eidx];
      if (qt === 0 && qtp1 === 0) return ["0"];
      if (qt === 0 && qtp1 === 1) return ["1"];
      if (qt === 1 && qtp1 === 0) return ["1"];
      if (qt === 1 && qtp1 === 1) return ["0"];
      if (qtp1 === "x") return ["x"];
    })
  );
};

let transSR = (fsm, s, i) => {
  let encodings = trans(fsm, s, i);
  return _.flatten(
    _.map(encodings, (qtp1, eidx) => {
      let qt = s[eidx];
      if (qt === 0 && qtp1 === 0) return ["0", "x"];
      if (qt === 0 && qtp1 === 1) return ["1", "0"];
      if (qt === 1 && qtp1 === 0) return ["0", "1"];
      if (qt === 1 && qtp1 === 1) return ["x", "0"];
      if (qtp1 === "x") return ["x", "x"];
    })
  );
};

let produceTransitionTables = fsm => {
  let inoutcomb = cartesian(
    codeWords(fsm.encodingSize),
    codeWords(fsm.inputSize)
  );

  let genTable = f => {
    return _.map(inoutcomb, vs => {
      let ss = _.take(vs, fsm.encodingSize);
      let ii = _.takeRight(vs, fsm.inputSize);
      return _.concat(ss, ii, _.flatten(f(fsm, ss, ii)));
    });
  };
  let column = (f, i) => {
    return _.map(inoutcomb, vs => {
      let ss = _.take(vs, fsm.encodingSize);
      let ii = _.takeRight(vs, fsm.inputSize);
      return _.flatten(f(fsm, ss, ii))[i];
    });
  };

  let genTableHeadings = f =>
    _.concat(
      _.map(_.range(0, fsm.encodingSize), i => `Q_${i}`),
      _.map(_.range(0, fsm.inputSize), i => `I_${i}`),
      _.flatten(_.map(_.range(0, fsm.encodingSize), i => f(i)))
    );

  let produceOTLatexMoore = (name, outputf) => {
    let genOTTable = f => {
      return _.map(codeWords(fsm.encodingSize), ss => {
        return _.concat(ss, f(fsm, ss));
      });
    };
    let otcolumn = (f, kk) => {
      return _.map(codeWords(fsm.encodingSize), ss => {
        return f(fsm, ss)[kk];
      });
    };
    let dta = genOTTable(outputf);
    let blk = genOTTable(() => _rep("", fsm.outputSize));
    let tableheadings = _.concat(
      _.map(_.range(0, fsm.encodingSize), i => `Q_${i}`),
      _.map(_.range(0, fsm.outputSize), i => `O_${i}`)
    );
    let invars = _.concat(_.map(_.range(0, fsm.encodingSize), i => `Q_${i}`));
    let outvars = _.concat(_.map(_.range(0, fsm.outputSize), i => `O_${i}`));
    let expressions = _.flatten(
      _.map(_.range(0, fsm.outputSize), kk => {
        let { solution, karnaugh } = quickSynth(
          _.join(otcolumn(outputf, kk), ""),
          invars
        );
        return [
          latexArtifact(
            `$${outvars[kk]} = ${solution}$`,
            `${outvars[kk]} expression`,
            "standalone",
            "pdflatex",
            "-r varwidth"
          ),
          latexArtifact(
            karnaugh,
            `${outvars[kk]} karnaugh map`,
            "standalone",
            "pdflatex",
            "--usepackage karnaugh-map -r varwidth"
          )
        ];
      })
    );
    return _.concat(
      [
        latexArtifact(
          latexTruth(dta, tableheadings),
          name,
          "standalone",
          "pdflatex",
          "-r varwidth"
        ),
        latexArtifact(
          latexTruth(blk, tableheadings),
          `${name} blank`,
          "standalone",
          "pdflatex",
          "-r varwidth"
        )
      ],
      expressions
    );
  };

  let produceTTLatex = (name, transf, size, headings) => {
    let dta = genTable(transf);
    let blk = genTable(() => _rep("", fsm.encodingSize * size));
    let thevars = _.concat(
      _.map(_.range(0, fsm.encodingSize), i => `Q_${i}`),
      _.map(_.range(0, fsm.inputSize), i => `I_${i}`)
    );

    let fhdgs = _.flatten(_.map(_.range(0, fsm.encodingSize), headings));
    let expressions = _.flatten(
      _.map(_.range(0, fsm.encodingSize * size), kk => {
        let { solution, karnaugh } = quickSynth(
          _.join(column(transf, kk), ""),
          thevars
        );
        return [
          latexArtifact(
            `$${fhdgs[kk]} = ${solution}$`,
            `${fhdgs[kk]} expression`,
            "standalone",
            "pdflatex",
            "-r varwidth"
          ),
          latexArtifact(
            karnaugh,
            `${fhdgs[kk]} karnaugh map`,
            "standalone",
            "pdflatex",
            "--usepackage karnaugh-map -r varwidth"
          )
        ];
      })
    );

    return _.concat(
      [
        latexArtifact(
          latexTruth(dta, genTableHeadings(headings)),
          name,
          "standalone",
          "pdflatex",
          "-r varwidth"
        ),
        latexArtifact(
          latexTruth(blk, genTableHeadings(headings)),
          `${name} blank`,
          "standalone",
          "pdflatex",
          "-r varwidth"
        )
      ],
      expressions
    );
  };

  let tt = produceTTLatex("transition table", trans, 1, i => `Q^*_${i}`);
  let dt = produceTTLatex("D excitation table", trans, 1, i => `D_${i}`);
  let jkt = produceTTLatex("JK excitation table", transJK, 2, i => [
    `J_${i}`,
    `K_${i}`
  ]);
  let srt = produceTTLatex("SR excitation table", transSR, 2, i => [
    `S_${i}`,
    `R_${i}`
  ]);
  let ttt = produceTTLatex("T excitation table", transT, 1, i => `T_${i}`);
  if (fsm.type !== "moore") {
    return _.flatten([tt, dt, jkt, srt, ttt]);
  } else {
    let ot = produceOTLatexMoore("Output table", outfunmoore);
    return _.flatten([tt, dt, jkt, srt, ttt, ot]);
  }
};

let synthesize = (fsm, options) => {
  let diagram = drawFSM(fsm, options);
  let ttables = produceTransitionTables(fsm);
  return _.merge({}, { diagram }, { ttables });
};

let formatResults = d => {
  return _.concat(
    [
      latexArtifact(
        d.diagram,
        "diagram",
        "standalone",
        "lualatex",
        "-z automata,quotes"
      )
    ],
    d.ttables
  );
};

let elaborateFSM = (fsm, options) => {
  if (options.draw) {
    console.log(drawFSM(fsm, options));
    return;
  } else {
    let data = { latex: formatResults(synthesize(fsm, options)) };
    if (options.save) {
      return saveArtifacts(data.latex, options.save);
    } else {
      console.log(JSON.stringify(data));
    }
  }
};

module.exports = { elaborateFSM, dumpEx };
