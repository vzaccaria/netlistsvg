#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const { compileArtifacts } = require("./lib/artifacts");
let $gstd = require("get-stdin");

// let _ = require("lodash");
let $fs = require("mz/fs");
let { exec } = require("mz/child_process");
let tmp = require("tmp-promise");
let open = require("open");

let compile = f => {
  tmp.dir({ unsafeCleanup: true }).then(o => {
    f = JSON.parse(f);
    compileArtifacts(f.latex, `${o.path}/artifact`)
      .then(() => exec(`mv ${o.path}/artifact-all.pdf .`))
      .then(() => open(`./artifact-all.pdf`))
      .then(() => o.cleanup());
  });
};

let main = () => {
  prog
    .description("View complete artifact")
    .argument("[file]", `The file containing the artifact`)
    .action(args => {
      let datap = args.file ? $fs.readFile(args.file, "utf8") : $gstd();
      datap.then(compile);
    });
  prog.parse(process.argv);
};

main();
