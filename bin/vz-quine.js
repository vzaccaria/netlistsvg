#!/usr/bin/env node
"use strict";

let { qm } = require("./qmc");
let _ = require("lodash");

const prog = require("caporal");

let produceTables = tables => {
  //console.log(tables.length);
  // let maxones = _.max(_.map(tables[0], "ones"));
  let reorderTable = t => _.sortBy(t, "ones");
  tables = _.map(tables, reorderTable);
  let toLatexTable = (t, i) => {
    return {
      title: `order ${i}`,
      data: _.map(
        t,
        m =>
          `${m.prime ? "\\bullet" : ""} \\texttt{(${m.values}) ${_.join(
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
\\begin{table}[H]
	\\newcommand{\\head}[1]{\\textcolor{white}{\\textbf{#1}}}		
		% \\rowcolors{2}{gray!10}{white} % Color every other line a light gray
                ${c}
\\end{table}
`;

let reduceToChartTable = chart => {
  let ncols = chart.cols.length;
  let head = `\\begin{tabular}{${_.repeat("c", ncols + 1)}}
\\rowcolor{black!75} & ${_.join(
    _.map(chart.cols, t => "\\head{" + t + "}"),
    " & "
  )} \\\\
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
            if (shouldHighlight(i, j)) return "\\bullet";
            else if (_.includes(i, j)) return "\\circ";
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
\\rowcolor{black!75}${_.join(
    _.map(titles, t => "\\head{" + t + "}"),
    " & "
  )} \\\\
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

let getSolutionTable = res => {
  return (
    `\\begin{itemize}` +
    _.join(
      _.map(res.coverSymbolic, i => {
        return `\\item \\texttt{${_.join(i.implicantSymbol)}} - (${_.join(
          i.implicantValue,
          ","
        )})`;
      }),
      "\n"
    ) +
    `\\end{itemize}`
  );
};

let main = () => {
  prog
    .description("Swiss Knife tool for boolean function minimization")
    .command("quinett", "produce a quine minimization sheet")
    .argument("<table>", "table")
    .action((args, options) => {
      let nvars = Math.ceil(Math.log2(args.table.length));
      let s = tt2qm(nvars, args.table);
      s.latex = {
        implicantsTables: reduceToTable(produceTables(s.implicantsTables)),
        sopForm: sopForm(s),
        implicantsCharts: _.map(s.implicantsCharts, reduceToChartTable),
        soluzione: `soluzione ricavata con ${
          s.implicantsCharts.length
        } passaggi: ${getSolutionTable(s)}`
      };
      console.log(JSON.stringify(s, 0, 4));
    });
  prog.parse(process.argv);
};

main();
