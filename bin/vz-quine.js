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

  let getImplicantGroup = g => {
    return _.map(g.group, i => {
      return {
        values: _.map(i.imp),
        essential: i.used,
        prime: i.isPrim,
        mask: i.bitMask
      };
    });
  };

  returned.primeImplicants = _.map(data.primTerms, i => {
    return {
      values: _.map(i.implicant.imp),
      essential: i.used,
      prime: i.isPrim,
      mask: i.bitMask
    };
  });
  returned.implicantsTables = _.map(data.implicantGroups, getImplicantGroup);

  return returned;
};

console.log(JSON.stringify(tt2qm(4, "1011/1101/1110/1010")));
