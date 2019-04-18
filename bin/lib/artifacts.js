let _ = require("lodash");
let $fs = require("mz/fs");
let { exec } = require("mz/child_process");

let latexArtifact = (code, name, clss, engine) => {
  let sfx = _.kebabCase(name);
  if (_.isUndefined(clss)) clss = "standalone";
  if (_.isUndefined(engine)) engine = "pdflatex";
  return {
    code,
    clss,
    name,
    sfx,
    engine
  };
};

let saveArtifact = _.curry((pfx, { sfx, code }) => {
  let name = `${pfx}-${sfx}.tex`;
  return $fs.writeFile(name, code, "utf8").then(() => name);
});

let compileArtifact = _.curry((pfx, a) => {
  saveArtifact(pfx, a).then(name => {
    return exec(`tikz2pdf ${name} -s ${a.clss} -e ${a.engine}`);
  });
});

let compileArtifacts = (data, pfx) => {
  Promise.all(_.map(data.latex, compileArtifact(pfx)));
};

module.exports = {
  latexArtifact,
  saveArtifact,
  compileArtifact,
  compileArtifacts
};
