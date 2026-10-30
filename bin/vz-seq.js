#!/usr/bin/env node
"use strict";

const exercises = require("./lib/vz-seq/exercises");
module.exports = { register: exercises.register };

if (require.main === module) {
  const prog = require("caporal");
  exercises.register(prog);
  prog.parse([process.argv[0], process.argv[1], "seq", ...process.argv.slice(2)]);
}
