let { qm } = require("./qmc");
let _ = require("lodash");

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

  let getImplicantGroup = g => {
    return _.map(g.group, i => {
      let im = {
        values: _.map(i.imp),
        essential: i.used,
        prime: i.isPrim,
        mask: i.bitMask
      };
      im.string = implicantString(im);
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
    return im;
  });
  returned.implicantsTables = _.map(data.implicantGroups, getImplicantGroup);

  return returned;
};

console.log(JSON.stringify(tt2qm(4, "1011/1101/1110/1010")));
