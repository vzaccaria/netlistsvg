const _ = require("lodash");

let getSize = o => {
  if (_.isObject(o)) {
    return _.reduce(o, (r, a) => r + getSize(a), 0);
  } else return 1;
};

let showField = ({ value }) => {
  if (_.isBoolean(value)) {
    if (value) return "$\\checkmark$";
    else return "$\\times$";
  } else {
    if (_.isNumber(value)) {
      return `\\texttt{${value}}`;
    } else return value;
  }
};

let toRow = j => {
  let { list } = toList(j);
  let fields = _.filter(list, "leaf");
  return _.join(_.map(fields, showField), " & ");
};

let toMultiColumnHead = j => {
  let printHead = s => {
    return _.join(
      _.map(s, ({ key, size, valid }) => {
        if (valid) {
          if (size === 1) return key;
          else return `\\multicolumn{${size}}{c|}{${key}}`;
        } else {
          return "";
        }
      }),
      " & "
    );
  };
  let { list, maxDepth } = toList(j);
  let hds = _.map(_.range(0, maxDepth + 1), extractDepth(list));
  let maximumExtension = _.last(hds).length;
  let mcheader = _.join(_.map(hds, printHead), "\\\\\n\\hline\n");
  let tabheader = _.join(_.map(_.range(0, maximumExtension), () => "c"), "|");
  return `\\begin{tabular}{|${tabheader}|}
${mcheader}\\\\ \\hline
`;
};

let toLatexTable = jlist => {
  let o = _.first(jlist);
  let header = toMultiColumnHead(o);
  let body = _.map(jlist, toRow);
  body = _.join(body, "\\\\ \n");
  return `
${header}
${body}
\\end{tabular}`;
};

let extractDepth = _.curry((list, d) => {
  let s = [];
  _.forEach(list, ({ key, depth, leaf, size }) => {
    if (depth === d) s.push({ key, size, valid: true });
    else {
      if (depth < d && leaf) s.push({ valid: false });
    }
  });
  return s;
});

const toList = j => {
  const l = [];
  traverse(x => l.push(x), j);
  return { list: l, maxDepth: _.maxBy(l, "depth").depth };
};

const _traverse = _.curry((n, phi, obj) => {
  for (let k in obj) {
    if (obj[k] && typeof obj[k] === "object") {
      _traverse(n + 1, phi, obj[k]);
      phi({
        key: k,
        value: obj[k],
        depth: n,
        size: getSize(obj[k]),
        leaf: false
      });
    } else {
      phi({
        key: k,
        value: obj[k],
        depth: n,
        size: getSize(obj[k]),
        leaf: true
      });
    }
  }
});

let traverse = _traverse(0);

module.exports = { toLatexTable };
