#!/usr/bin/env node
"use strict";

let { qm } = require("./qmc");
let _ = require("lodash");
let $fs = require("mz/fs");
let { latexArtifact } = require("./artifacts");

let produceTables = tables => {
  //console.log(tables.length);
  // let maxones = _.max(_.map(tables[0], "ones"));
  let reorderTable = t => _.sortBy(t, "ones");
  tables = _.map(tables, reorderTable);
  let toLatexTable = (t, i) => {
    return {
      title: `Imp. Ord. ${i}`,
      data: _.map(
        t,
        m =>
          `${m.prime ? "$\\bullet$" : ""} (${m.values}) \\texttt{${_.join(
            m.string,
            ""
          )}} `
      )
    };
  };
  return _.map(tables, toLatexTable);
};

// invoked with any of .original.primTermTables[i]

let implicantChart = res => {
  let rows = _.map(res.remainingPrimTerms, i => _.map(i.implicant.imp));
  let cols = res.remainingVars;
  let highlight = _.map(res.essentialPrimTerms, i => {
    let row = _.map(i.implicant.imp);
    let col = _.keys(i.neededByVar);
    return { row, col };
  });
  return { rows, cols, highlight };
};

let sopForm = res => {
  let on = _.filter(
    _.map(res.funcdata, (v, i) => (v === 1 ? i : undefined)),
    x => x !== undefined
  );
  let ons = _.join(on, ", ");
  let dc = _.filter(
    _.map(res.funcdata, (v, i) => (v === 2 ? i : undefined)),
    x => x !== undefined
  );
  let dcs = _.join(dc, ", ");
  return `\\begin{equation}\\mathrm{on} = \\sum (${ons}), \\mathrm{dc} = \\sum (${dcs}) \\end{equation}`;
};

let table = c => `
\\begin{table}[h]
                ${c}
\\end{table}
`;

let reduceToChartTable = chart => {
  let ncols = chart.cols.length;
  let head = `\\begin{tabular}{${_.repeat("c", ncols + 1)}}
 Impl. & ${_.join(_.map(chart.cols, t => "{" + t + "}"), " & ")} \\\\
`;
  let shouldHighlight = (i, j) => {
    return (
      _.sum(
        _.map(chart.highlight, ({ row, col }) => {
          col = _.map(col, parseInt);
          if (_.isEqual(row, i) && _.includes(col, j)) return 1;
          else return 0;
        })
      ) !== 0
    );
  };
  let rows = _.join(
    _.map(chart.rows, i => {
      let sr = `(${_.join(i, ",")})`;
      return (
        sr +
        " & " +
        _.join(
          _.map(chart.cols, j => {
            if (shouldHighlight(i, j)) return "$\\bullet$";
            else if (_.includes(i, j)) return "$\\circ$";
            else return "";
          }),
          " & "
        )
      );
    }),
    "\\\\ \n"
  );
  let tail = `
        \\end{tabular}`;
  return table(head + rows + tail);
};

let reduceToTable = columns => {
  let cols = _.map(columns, "data");
  let titles = _.map(columns, "title");
  let ncols = cols.length;
  let head = `\\begin{tabular}{${_.repeat("r", ncols)}}
${_.join(_.map(titles, t => "{" + t + "}"), " & ")} \\\\
`;

  let rows = _.join(
    _.zipWith(...cols, function() {
      return _.join(arguments, " & ");
    }),
    `\\\\ \n`
  );
  let tail = `
        \\end{tabular}`;
  return table(head + rows + tail);
};

let tt2qm = (n, tt) => {
  let data = new qm();
  data.init(n);
  let j = 0;
  _.map(tt, v => {
    if (v !== "/") {
      data.funcdata[j++] = v === "x" || v === "-" ? 2 : v === "1" ? 1 : 0;
    }
  });
  data.compute();
  let returned = {};

  let valueWithMask = (bits, mask) => {
    let str = [];
    var res = bits.toString(2);
    for (var j = 0; j < n; j++) {
      var currentBit = Math.pow(2, n - 1 - j);
      if ((currentBit & mask) === currentBit) {
        str.push("-");
      } else {
        if (j >= n - res.length) {
          str.push(res.charAt(j - (n - res.length)));
        } else {
          str.push("0");
        }
      }
    }
    return str;
  };

  let implicantString = ({ values, mask }) => {
    let val = _.reduce(values, (a, v) => a | v, 0);
    return valueWithMask(val, mask);
  };
  let countOnes = ({ string }) => {
    return _.sum(_.map(string, c => c === "1"));
  };

  let getImplicantGroup = g => {
    return _.map(g.group, i => {
      let im = {
        values: _.map(i.imp),
        essential: i.used,
        prime: i.isPrim,
        mask: i.bitMask
      };
      im.string = implicantString(im);
      im.ones = countOnes(im);
      return im;
    });
  };

  returned.primeImplicants = _.map(data.primTerms, i => {
    let im = {
      values: _.map(i.implicant.imp),
      essential: i.used,
      prime: i.isPrim,
      mask: i.bitMask
    };
    im.string = implicantString(im);
    im.ones = countOnes(im);
    return im;
  });

  returned.funcdata = data.funcdata;
  returned.implicantsTables = _.map(data.implicantGroups, getImplicantGroup);
  returned.implicantsCharts = _.map(data.primTermTables, implicantChart);
  returned.cover = _.map(data.minimalTermPrims, i => {
    return _.map(i.implicant.imp);
  });
  returned.coverSymbolic = _.map(data.minimalTermPrims, i => {
    let k = _.map(i.implicant.imp);
    let kk = _.find(_.flatten(returned.implicantsTables), j => {
      return _.isEqual(j.values, k);
    });
    return { implicantValue: k, implicantSymbol: kk.string };
  });
  // returned.original = data;
  return returned;
};

let isCornerH = implicantSymbol =>
  !_.isNull(_.join(implicantSymbol, "").match(/..-0/));
let isCornerV = implicantSymbol =>
  !_.isNull(_.join(implicantSymbol, "").match(/-0../));
// 0 1 3 2
// 4 5 7 6
// 12 13 15 14
// 8 9 11 10
//
let vedge = is => {
  let t = {
    "-000": [0, 0, 8, 8],
    "-001": [1, 1, 9, 9],
    "-00-": [0, 1, 8, 9],
    "-010": [2, 2, 10, 10],
    "-011": [3, 3, 11, 11],
    "-01-": [3, 2, 11, 10],
    "-0-1": [1, 3, 9, 11],
    "-0--": [0, 2, 8, 10]
  };
  is = _.join(is, "");
  let vv = t[is];
  return `{${vv[0]}}{${vv[1]}}{${vv[2]}}{${vv[3]}}`;
};
let hedge = is => {
  let t = {
    "00-0": [0, 0, 2, 2],
    "01-0": [4, 4, 6, 6],
    "0--0": [0, 4, 2, 6],
    "10-0": [8, 8, 10, 10],
    "11-0": [12, 12, 14, 14],
    "1--0": [12, 8, 14, 10],
    "-1-0": [4, 12, 6, 14],
    "---0": [0, 8, 2, 10]
  };
  is = _.join(is, "");
  let vv = t[is];
  return `{${vv[0]}}{${vv[1]}}{${vv[2]}}{${vv[3]}}`;
};

let zigzag = [0, 4, 1, 12, 5, 3, 8, 13, 7, 2, 9, 15, 6, 11, 14, 10];

let _getTopLeft = implicantValue =>
  _.find(zigzag, i => _.includes(implicantValue, i));

let _getBottomRight = implicantValue =>
  _.findLast(zigzag, i => _.includes(implicantValue, i));

let karnaughImp = ({ implicantSymbol, implicantValue }) => {
  let tl = _getTopLeft(implicantValue);
  let br = _getBottomRight(implicantValue);

  if (isCornerH(implicantSymbol) && isCornerV(implicantSymbol))
    return "\\implicantcorner";
  if (isCornerH(implicantSymbol)) {
    return `\\implicantedge${hedge(implicantSymbol)}`;
  }
  if (isCornerV(implicantSymbol)) {
    return `\\implicantedge${vedge(implicantSymbol)}`;
  }
  return `\\implicant{${tl}}{${br}}`;
};

let karnaugh = ({ funcdata, coverSymbolic }, vars) => {
  let vab = `$${vars[0]}${vars[1]}$`;
  let vcd = `$${vars[2]}${vars[3]}$`;
  return `
 \\begin{center}
    \\begin{karnaugh-map}[4][4][1][${vcd}][${vab}]
    \\manualterms{${_.join(_.map(funcdata, f => (f === 2 ? "x" : f)), ",")}}
    ${_.join(_.map(coverSymbolic, karnaughImp), "\n")}
    \\end{karnaugh-map}
\\end{center}
`;
};

let getSolutionTable = res => {
  return (
    `\\begin{itemize}` +
    _.join(
      _.map(res.coverSymbolic, i => {
        return `\\item \\texttt{${_.join(
          i.implicantSymbol,
          ""
        )}} prodotta dall'implicante (${_.join(i.implicantValue, ",")})`;
      }),
      "\n"
    ) +
    `\\end{itemize}`
  );
};

let symbolicAsLogicFormula = _.curry((vars, i) => {
  let val = _.join(
    _.filter(
      _.map(i.implicantSymbol, (s, n) =>
        s === "1" ? vars[n] : s === "0" ? `\\overline{${vars[n]}}` : undefined
      )
    ),
    " \\cdot "
  );
  return val;
});

let symbolicSolution = _.curry((vars, res) =>
  _.join(_.map(res.coverSymbolic, symbolicAsLogicFormula(vars)), "+")
);

let synthesize = (data, vars) => {
  let nvars = vars.length;
  let s = tt2qm(nvars, data);
  let implicantsChartsAll = _.join(
    _.map(s.implicantsCharts, (i, x) => {
      return `\\noindent Iterazione ${x}: \\ ${reduceToChartTable(i)}`;
    }),
    "\n"
  );
  let soluzione = `\\noindent La soluzione ricavata con ${
    s.implicantsCharts.length
  } passaggi è la seguente: ${getSolutionTable(
    s
  )} ovvero \\[ ${symbolicSolution(vars, s)} \\]`;

  let kmap =
    nvars === 4 ? karnaugh(s, vars) : "only 4 variables maps are supported";

  s.latex = _.concat(
    [
      latexArtifact(
        reduceToTable(produceTables(s.implicantsTables)),
        "implicants tables",
        "standalone",
        "pdflatex",
        "-r varwidth"
      ),
      latexArtifact(
        sopForm(s),
        "sop form",
        "standalone",
        "pdflatex",
        "-r varwidth"
      ),
      latexArtifact(
        implicantsChartsAll,
        "implicant charts complete",
        "standalone",
        "pdflatex",
        "-r varwidth"
      ),
      latexArtifact(
        soluzione,
        "solution detailed",
        "standalone",
        "pdflatex",
        "-r varwidth"
      ),
      latexArtifact(
        `$${symbolicSolution(vars, s)}$`,
        "solution expression",
        "standalone",
        "pdflatex",
        "-r varwidth"
      ),
      latexArtifact(
        kmap,
        "karnaugh maps",
        "standalone",
        "pdflatex",
        "--usepackage karnaugh-map -r varwidth"
      )
    ],
    _.map(s.implicantsCharts, (c, i) => {
      return latexArtifact(
        reduceToChartTable(c),
        `implicant chart ${i}`,
        "standalone",
        "pdflatex",
        "-r varwidth"
      );
    })
  );
  return s;
};

module.exports = { synthesize };
