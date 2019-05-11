let _ = require("lodash");
let $fs = require("mz/fs");
let { latexArtifact, saveArtifacts } = require("./artifacts");
let { quickSynth } = require("./quine");

let edgespec = `{nodes={inner sep=1pt, anchor=mid, circle, fill=white}}`;

let wrap = (c, options, fsm) => {
  let layout = _.get(
    fsm,
    "graphics.graphOptions",
    "spring layout, node distance=2cm"
  );
  return `
\\begin{tikzpicture}[>=stealth', initial text=$ $]
\\graph[${layout},
       random seed=${options.randomSeed},
       edges=${edgespec}]{
       ${c}
};
\\end{tikzpicture} 
`;
};

let getTransStateName = q => _.keys(q)[0];

let parseName = n => {
  let regexp = /(?<name>.*)\/(?<lab>[ud\-]?)(b(?<angle>.*))?/;
  if (!_.isNull(n.match(regexp))) {
    let match = n.match(regexp).groups;
    if (!_.isUndefined(match)) {
      let r = { name: match.name };
      r.lab = match.lab;
      r.angle = match.angle ? match.angle : "30";
      return r;
    } else {
      throw "invalid specified nodes";
      // return { name: n, lab: "u", angle: "30" };
    }
  } else {
    return { name: n, lab: "", angle: "30" };
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
    if (_.get(fsm, "graphics.initialLabPos"))
      ops = _.concat(ops, [
        "initial where=" + _.get(fsm, "graphics.initialLabPos")
      ]);
  }
  return _.join(ops, ",");
};

let labelcmd = (lab, label, isLoop) => {
  if (isLoop) {
    return `edge node={node [auto, fill=none] {\\tiny${label}}}`;
  } else {
    if (lab === "") {
      return `edge node={node [] {\\tiny ${label}}}`;
    } else {
      if (lab === "d") {
        return `edge node={node [auto,fill=none] {\\tiny${label}}}`;
      } else return `edge node={node [auto, swap,fill=none] {\\tiny${label}}}`;
    }
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
    label,
    n1 === n2
  )}] "$${n2}$" [state]`;
};

let getMooreTransLabel = (fsm, n1, n2, input) => {
  let l;
  if ((l = _.get(fsm, `graphics.transLabels[${n1}/${n2}]`))) {
    return l;
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
    label,
    n1 === n2
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
  return wrap(_.join(moore(fsm), ",\n"), options, fsm);
};

let produceMealy = (fsm, options) => {
  return wrap(_.join(mealy(fsm), ",\n"), options, fsm);
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
  if (fsm.type === "moore") return { curState, nextStates };
  else {
    let outputs = _.map(ls, e => _.values(e)[0]);
    return { curState, nextStates, outputs };
  }
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

let getOutputsTable = fsm => {
  return Object.assign(
    ..._.map(fsm.transitions, t => {
      let { curState, outputs } = getTransition(fsm, t);
      let o = {};
      o[curState] = outputs;
      return o;
    })
  );
};

let outfunmealy = (fsm, s, i) => {
  if (i.length !== fsm.inputSize) throw "wrong input size!";
  let stateName = _.findKey(fsm.encoding, v => {
    return _.isEqual(v, s);
  });
  let undef = _.map(_.repeat("x", fsm.outputSize));
  if (_.isUndefined(stateName)) return undef;
  else {
    let inputEncoding = parseInt(_.join(i, ""), 2);
    let ttable = getOutputsTable(fsm);
    return ttable[stateName][inputEncoding];
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

let latexTable = (data, heads, name) => {
  return latexArtifact(
    latexTruth(data, heads),
    name,
    "standalone",
    "pdflatex",
    "-r varwidth"
  );
};

let exprOf = (n, e) =>
  latexArtifact(
    `$${n} = ${e}$`,
    `${n} expression`,
    "standalone",
    "pdflatex",
    "-r varwidth"
  );

let karnaughOf = (n, karnaugh) =>
  latexArtifact(
    karnaugh,
    `${n} karnaugh map`,
    "standalone",
    "pdflatex",
    "--usepackage karnaugh-map -r varwidth"
  );

let genLatexTables = (fsm, name, ins, outs, f) => {
  /* each element in ins and outs is { size: x, prefix: 'Q' } */
  let insvect = _.map(ins, ({ size }) => codeWords(size));
  let inspace = insvect[0];
  _.forEach(_.slice(insvect, 1), x => {
    inspace = cartesian(inspace, x);
  });
  let inssize = _.reduce(ins, (a, { size }) => a + size, 0);
  let outsize = _.reduce(outs, (a, { size }) => a + size, 0);
  let minsize = outs[0].size;
  let genTable = m =>
    _.map(inspace, vs => {
      let pars = [];
      _.forEach(ins, ({ size }) => {
        pars.push(_.take(vs, size));
        vs = _.slice(vs, size);
      });
      return _.concat(...pars, _.flatten(m(fsm, ...pars)));
    });
  let headings = [];
  let invars = [];
  let outvars = [];
  _.forEach(ins, ({ size, prefix }) => {
    let h = _.map(_.range(0, size), i => `${prefix}_${i}`);
    headings.push(h);
    invars.push(h);
  });
  _.forEach(_.range(0, minsize), i => {
    let h = _.map(outs, ({ prefix }) => `${prefix}_${i}`);
    headings.push(h);
    outvars.push(h);
  });
  headings = _.flatten(headings);
  invars = _.flatten(invars);
  outvars = _.flatten(outvars);
  let dataTable = genTable(f);
  let blankTable = genTable(() => _rep("", outsize));

  let column = i => {
    return _.map(inspace, (v, row) => {
      return dataTable[row][inssize + i];
    });
  };

  let expressionsAndKarnaugh = _.flatten(
    _.map(outvars, (c, i) => {
      let { solution, karnaugh } = quickSynth(_.join(column(i), ""), invars);
      return [exprOf(c, solution), karnaughOf(c, karnaugh)];
    })
  );
  let result = _.flatten([
    latexTable(dataTable, headings, name),
    latexTable(blankTable, headings, `${name} blank`),
    expressionsAndKarnaugh
  ]);
  return result;
};

let produceTransitionTables = fsm => {
  let ssi = s => {
    return { prefix: s, size: fsm.encodingSize };
  };
  let ii = { prefix: "I", size: fsm.inputSize };
  let ins = [ssi("Q"), ii];
  let oi = { prefix: "O", size: fsm.outputSize };
  let _ttn = "transition table";
  let _otn = "Output table";
  let _etn = s => `${s} excitation table`;
  let tt = genLatexTables(fsm, _ttn, ins, [ssi("Q^*")], trans);
  let dt = genLatexTables(fsm, _etn("D"), ins, [ssi("D")], trans);
  let jkt = genLatexTables(fsm, _etn("JK"), ins, [ssi("J"), ssi("K")], transJK);
  let srt = genLatexTables(fsm, _etn("SR"), ins, [ssi("S"), ssi("R")], transSR);
  let ttt = genLatexTables(fsm, _etn("T"), ins, [ssi("T")], transT);
  let ot;
  if (fsm.type === "mealy") {
    ot = genLatexTables(fsm, _otn, ins, [oi], outfunmealy);
    return _.flatten([tt, dt, jkt, srt, ttt, ot]);
  } else {
    ot = genLatexTables(fsm, _otn, [ssi("Q")], [oi], outfunmoore);
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
