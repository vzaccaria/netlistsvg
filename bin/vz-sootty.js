#!/usr/bin/env node
"use strict";

const fs = require("mz/fs");
const { maskSoottySvg } = require("./lib/sootty-mask");

const SUBNAME = "sootty";

const register = prog => {
  prog
    .command(`${SUBNAME} mask`, "Mask signal rows in a sootty SVG")
    .argument("<source>", "complete sootty SVG")
    .argument("<target>", "masked sootty SVG")
    .argument("<signals>", "comma-separated signal names")
    .action(async args => {
      const source = await fs.readFile(args.source, "utf8");
      const signals = args.signals.split(",");
      const masked = maskSoottySvg(source, signals);
      await fs.writeFile(args.target, masked, "utf8");
    });
};

module.exports = { register };

if (require.main === module) {
  const prog = require("caporal");
  register(prog);
  prog.parse([
    process.argv[0],
    process.argv[1],
    SUBNAME,
    ...process.argv.slice(2)
  ]);
}
