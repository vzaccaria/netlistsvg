let _ = require("lodash");
let $fs = require("mz/fs");

let wrap = c => `
\\usegdlibrary{force}
\\tikzstyle{branch}=[fill,shape=circle,minimum size=2pt,inner sep=0pt]
\\begin{tikzpicture}[>=stealth', initial text=$ $]
\\graph[spring layout,
       random seed=1,
       node distance=2cm]{
       ${c}
};
\\end{tikzpicture} 
`;

// "$s_1$" [state] -> [bend right]               "$s_2$" [state],
// "$s_1$" [state] -> [bend left, edge label={\\footnotesize $1/0$}] "$s_3$" [state],
// "$s_3$" [state] -> [bend left, edge label={\\footnotesize $1/1$}] "$s_1$" [state],
// "$s_4$" [state] -> [loop above] "$s_4$" [state]
// "$s_4$" [state] -> "$s_1$" [state]
//
//
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

let produceMoore = fsm => {
  return wrap(_.join(moore(fsm), ",\n"));
};

let produceMealy = fsm => {
  return wrap(_.join(mealy(fsm), ",\n"));
};

let produceFsm = fsm => {
  if (fsm.type === "mealy") return produceMealy(fsm);
  else return produceMoore(fsm);
};

let dumpEx = m => {
  $fs.readFile(`${__dirname}/examples/${m}.json`, "utf8").then(console.log);
};

module.exports = { produceFsm, dumpEx };
