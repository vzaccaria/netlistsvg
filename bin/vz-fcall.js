#!/usr/bin/env node
"use strict";

const prog = require("caporal");
const { execWithStringStdErr } = require("./lib/common");
let $gstd = require("get-stdin");
const _ = require("lodash");

let $fs = require("mz/fs");

let main = () => {
  prog
    .description("Function call utils")
    .command("call", "generates artifacts for a call")
    .argument("<json>", `File describing the call sequence`)
    .action(async (args, options) => {});
  prog.parse(process.argv);
};

main();
