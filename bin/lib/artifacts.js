let _ = require("lodash");
let $fs = require("mz/fs");
let { exec } = require("mz/child_process");

let re = require("replace-ext");

let latexArtifact = (code, name, clss, engine, addoptions) => {
  let sfx = _.kebabCase(name);
  if (_.isUndefined(clss)) clss = "standalone";
  if (_.isUndefined(engine)) engine = "pdflatex";

  return {
    code,
    clss,
    name,
    sfx,
    engine,
    addoptions
  };
};

let saveArtifact = _.curry((pfx, { sfx, code }) => {
  let name = `${pfx}-${sfx}.tex`;
  console.log(`Saving ${name}`);
  return $fs.writeFile(name, code, "utf8").then(() => name);
});

let compileArtifact = _.curry((pfx, a) => {
  return saveArtifact(pfx, a).then(name => {
    let command = `tikz2pdf ${name} -s ${a.clss} -e ${a.engine} ${
      a.addoptions ? a.addoptions : ""
    }`;
    console.log(`Compiling with ${command}`);
    return exec(command).then(() => re(name, ".pdf"));
  });
});

let compileArtifacts = (data, pfx) => {
  Promise.all(_.map(data, compileArtifact(pfx))).then(names => {
    return exec(`pdftk ${_.join(names, " ")} cat output ${pfx}-all.pdf`);
  });
};

let saveArtifacts = (data, pfx) => {
  Promise.all(_.map(data, saveArtifact(pfx)));
};

module.exports = {
  latexArtifact,
  saveArtifact,
  saveArtifacts,
  compileArtifact,
  compileArtifacts
};
