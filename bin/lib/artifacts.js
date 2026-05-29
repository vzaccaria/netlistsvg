let _ = require("lodash");
let $fs = require("mz/fs");
let path = require("path");
let { exec } = require("mz/child_process");
let tmp = require("tmp-promise");

let re = require("replace-ext");

let latexArtifact = (
  code,
  name,
  clss,
  engine,
  addoptions,
  packages,
  tikzLibraries,
  preamble
) => {
  let sfx = _.kebabCase(name);
  if (_.isUndefined(clss)) clss = "standalone";
  if (_.isUndefined(engine)) engine = "pdflatex";
  if (_.isUndefined(packages)) packages = [];
  if (_.isUndefined(tikzLibraries)) tikzLibraries = [];
  if (_.isUndefined(preamble)) preamble = "";

  return {
    code,
    clss,
    name,
    sfx,
    engine,
    addoptions,
    packages,
    tikzLibraries,
    preamble
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
  return Promise.all(_.map(data, compileArtifact(pfx))).then(names => {
    let cmd = `pdftk ${_.join(names, " ")} cat output ${pfx}-all.pdf`;
    console.log(cmd);
    return exec(cmd).then(() => {
      let cmd = `rm ${_.join(names, " ")}`;
      return exec(cmd);
    });
  });
};

let saveArtifacts = (data, pfx) => {
  return Promise.all(_.map(data, saveArtifact(pfx)));
};

// xelatex + pdfcrop pipeline that mirrors pac/exam-sheets assets.mk.
// Wraps each artifact's `code` with a fontspec/geometry preamble plus the
// per-artifact `packages` and `tikzLibraries`. All intermediate files
// (.tmp.tex, .aux, .log, _minted*) are kept in a temp dir; only the final
// cropped `<pfx>-<sfx>.pdf` lands next to the user's prefix.
let wrapTex = (a, font) => {
  let pkgLines = _.map(a.packages, p => `\\usepackage{${p}}`).join("\n");
  let libLines = _.map(
    a.tikzLibraries,
    l => `\\usetikzlibrary{${l}}`
  ).join("\n");
  return [
    "\\documentclass[a4paper,landscape]{article}",
    "\\usepackage{fontspec}",
    `\\setmainfont{${font}}`,
    "\\usepackage[margin=.5cm]{geometry}",
    pkgLines,
    libLines,
    a.preamble || "",
    "\\pagestyle{empty}",
    "\\begin{document}",
    a.code,
    "\\end{document}",
    ""
  ].join("\n");
};

let compileArtifactXelatex = (pfx, a, opts) => {
  let font = (opts && opts.font) || "Minion Pro";
  // Resolve final output path; honour pfx that includes a directory.
  let outDir = path.resolve(path.dirname(pfx));
  let outBase = `${path.basename(pfx)}-${a.sfx}`;
  let outPdf = path.join(outDir, `${outBase}.pdf`);

  return tmp
    .dir({ unsafeCleanup: true, prefix: "vzpac-tex-" })
    .then(async ({ path: workdir, cleanup }) => {
      try {
        let texName = `${outBase}.tex`;
        let texPath = path.join(workdir, texName);
        let pdfPath = path.join(workdir, `${outBase}.pdf`);
        await $fs.writeFile(texPath, wrapTex(a, font), "utf8");
        let xelatex = `xelatex -interaction=nonstopmode -shell-escape ${texName}`;
        console.log(`XELATEX ${texName}`);
        await exec(xelatex, { cwd: workdir });
        await exec(`pdfcrop ${pdfPath} ${outPdf}`);
        return outPdf;
      } finally {
        await cleanup();
      }
    });
};

let compileArtifactsXelatex = (data, pfx, opts) => {
  return Promise.all(_.map(data, a => compileArtifactXelatex(pfx, a, opts)));
};

// Dispatch helper for vz-* CLI tools: pick saveArtifacts (.tex) or
// compileArtifactsXelatex (.pdf) based on caporal options.
let writeArtifacts = (data, options) => {
  if (options.compile) {
    return compileArtifactsXelatex(data, options.save, {
      font: options.font
    });
  }
  return saveArtifacts(data, options.save);
};

// Register the shared --compile / --font options on a caporal command.
let addCompileOptions = cmd => {
  return cmd
    .option(
      "-c, --compile",
      "Compile artifacts to PDF (xelatex+pdfcrop) instead of saving .tex"
    )
    .option(
      "--font <name>",
      "Main font for --compile (xelatex pipeline)",
      undefined,
      "Minion Pro"
    );
};

module.exports = {
  latexArtifact,
  saveArtifact,
  saveArtifacts,
  compileArtifact,
  compileArtifacts,
  compileArtifactXelatex,
  compileArtifactsXelatex,
  writeArtifacts,
  addCompileOptions,
  wrapTex
};
