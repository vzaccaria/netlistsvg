let fs = require("fs");
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

// Max concurrent LaTeX compilations per vzpac process (one engine per
// artifact otherwise: FSM synthesis alone has ~66). Override: VZPAC_JOBS.
let maxJobs = () => {
  let n = parseInt(process.env.VZPAC_JOBS, 10);
  return n > 0 ? n : 2;
};

// Like Promise.all(_.map(items, fn)) but with at most maxJobs() in flight;
// results keep the input order.
let mapLimited = (items, fn) => {
  let list = _.values(items);
  let results = new Array(list.length);
  let next = 0;
  let worker = async () => {
    while (next < list.length) {
      let i = next++;
      results[i] = await fn(list[i]);
    }
  };
  let n = Math.min(maxJobs(), list.length);
  return Promise.all(_.times(n, worker)).then(() => results);
};

let compileArtifacts = (data, pfx) => {
  return mapLimited(data, compileArtifact(pfx)).then(names => {
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

// Packages and TikZ libraries that `tikz2pdf` (the legacy compiler of these
// artifacts) always loads; artifact code relies on them (e.g. `stealth'`).
const legacyPackages = ["tikz", "xcolor", "amsmath", "amssymb"];
const legacyTikzLibraries = [
  "arrows",
  "chains",
  "matrix",
  "positioning",
  "scopes",
  "calc",
  "arrows.meta",
  "fit",
  "shapes.geometric",
  "circuits.logic.US"
];

// Extract packages, TikZ libraries and preamble includes from the legacy
// tikz2pdf option string stored in `addoptions`
// (`--usepackage a,b`, `-z/--usetikzlibrary a,b`, `-i/--include f,g`).
let parseAddOptions = addoptions => {
  let res = { packages: [], tikzLibraries: [], includes: [] };
  let toks = _.compact(_.split(addoptions || "", /\s+/));
  let list = i => _.compact(_.split(toks[i + 1] || "", ","));
  _.forEach(toks, (t, i) => {
    if (t === "--usepackage" || t === "-c") res.packages.push(...list(i));
    if (t === "--usetikzlibrary" || t === "-z")
      res.tikzLibraries.push(...list(i));
    if (t === "--include" || t === "-i") res.includes.push(...list(i));
  });
  return res;
};

let isLuaArtifact = a => a.engine === "lualatex";

// xelatex (lualatex for `engine: "lualatex"` artifacts, e.g. graphdrawing
// FSM layouts) + pdfcrop pipeline that mirrors pac/exam-sheets assets.mk.
// Wraps each artifact's `code` with a fontspec/geometry preamble plus the
// legacy tikz2pdf defaults, the per-artifact `packages`/`tikzLibraries` and
// those encoded in `addoptions`. All intermediate files (.tmp.tex, .aux,
// .log, _minted*) are kept in a temp dir; only the final cropped
// `<pfx>-<sfx>.pdf` lands next to the user's prefix.
let wrapTex = (a, font, fontMono) => {
  let legacy = parseAddOptions(a.addoptions);
  let packages = _.uniq(
    _.concat(legacyPackages, a.packages || [], legacy.packages)
  );
  let libraries = _.uniq(
    _.concat(legacyTikzLibraries, a.tikzLibraries || [], legacy.tikzLibraries)
  );
  let pkgLines = _.map(packages, p => `\\usepackage{${p}}`).join("\n");
  let libLines = _.map(libraries, l => `\\usetikzlibrary{${l}}`).join("\n");
  let gdLines = isLuaArtifact(a)
    ? [
        "\\usetikzlibrary{graphdrawing}",
        "\\usetikzlibrary{graphs}",
        "\\usegdlibrary{trees}",
        "\\usegdlibrary{force}"
      ].join("\n")
    : "";
  // Skip includes whose content is already inlined as `preamble`.
  let includeLines = _.map(
    _.filter(
      legacy.includes,
      f =>
        !(a.preamble && fs.existsSync(f) && fs.readFileSync(f, "utf8") === a.preamble)
    ),
    f => `\\input{${f}}`
  ).join("\n");
  let monoLine = _.isUndefined(fontMono)
    ? ""
    : `\\setmonofont{${fontMono}}`;
  return _.compact([
    "\\documentclass[a4paper,landscape]{article}",
    "\\usepackage{fontspec}",
    `\\setmainfont{${font}}`,
    "\\usepackage[margin=.5cm]{geometry}",
    monoLine,
    pkgLines,
    libLines,
    gdLines,
    includeLines,
    a.preamble || "",
    "\\pagestyle{empty}",
    "\\begin{document}",
    a.code,
    "\\end{document}",
    ""
  ]).join("\n");
};

let compileArtifactXelatex = (pfx, a, opts) => {
  let font = (opts && opts.font) || "Minion Pro";
  let fontMono = opts && opts.fontMono;
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
        await $fs.writeFile(texPath, wrapTex(a, font, fontMono), "utf8");
        let engine = isLuaArtifact(a) ? "lualatex" : "xelatex";
        let latex = `${engine} -interaction=nonstopmode -shell-escape ${texName}`;
        console.log(`${_.toUpper(engine)} ${texName}`);
        await exec(latex, { cwd: workdir });
        await exec(`pdfcrop ${pdfPath} ${outPdf}`);
        return outPdf;
      } finally {
        await cleanup();
      }
    });
};

let compileArtifactsXelatex = (data, pfx, opts) => {
  return mapLimited(data, a => compileArtifactXelatex(pfx, a, opts));
};

// Dispatch helper for vz-* CLI tools: pick saveArtifacts (.tex) or
// compileArtifactsXelatex (.pdf) based on caporal options.
let writeArtifacts = (data, options) => {
  if (options.compile) {
    return compileArtifactsXelatex(data, options.save, {
      font: options.font,
      fontMono: options.fontMono
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
    )
    .option(
      "--font-mono <name>",
      "Monospace font for --compile (xelatex pipeline)"
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
