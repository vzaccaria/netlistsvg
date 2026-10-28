#!/usr/bin/env node
"use strict";

const { register } = require("./lib/vz-memory/exercises");
module.exports = { register };

if (require.main === module) {
  const prog = require("caporal");
  register(prog);
  prog.parse([process.argv[0], process.argv[1], "memory", ...process.argv.slice(2)]);
}
