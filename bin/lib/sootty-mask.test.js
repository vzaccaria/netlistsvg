"use strict";

/* global describe, it */

const { expect } = require("chai");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const onml = require("onml");
const { maskSoottySvg } = require("./sootty-mask");

const source = [
  '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">',
  '<rect x="0" y="0" width="200" height="100" fill="#000000" />',
  '<text x="110" y="20">0</text>',
  '<text x="15" y="50">clk</text>',
  '<line x1="99" x2="199" y1="55" y2="55" stroke="#ffffff" />',
  '<text x="15" y="80">Q</text>',
  '<line x1="99" x2="199" y1="65" y2="85" stroke="#ffffff" />',
  "</svg>"
].join("");

describe("maskSoottySvg", () => {
  it("masks a named row without changing SVG geometry or labels", () => {
    const masked = onml.parse(maskSoottySvg(source, ["Q"]));
    const elements = masked.filter(Array.isArray);
    const mask = elements[elements.length - 1];

    expect(masked[1].viewBox).to.equal("0 0 200 100");
    expect(mask).to.deep.equal([
      "rect",
      {
        x: "98",
        y: "62",
        width: "102",
        height: "26",
        fill: "#171717"
      }
    ]);
    expect(
      elements.some(element => element[0] === "text" && element[2] === "Q")
    ).to.equal(true);
  });

  it("registers the masker under vzpac sootty mask", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vzpac-sootty-"));
    const input = path.join(directory, "full.svg");
    const output = path.join(directory, "blank.svg");

    try {
      fs.writeFileSync(input, source);
      childProcess.execFileSync(
        process.execPath,
        [
          path.resolve(__dirname, "..", "vzpac.js"),
          "sootty",
          "mask",
          input,
          output,
          "Q"
        ],
        { stdio: "pipe" }
      );

      const masked = onml.parse(fs.readFileSync(output, "utf8"));
      expect(masked[1].viewBox).to.equal("0 0 200 100");
      expect(masked[masked.length - 1][1].fill).to.equal("#171717");
    } finally {
      [input, output].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
      fs.rmdirSync(directory);
    }
  });

  it("rejects signal names absent from the SVG", () => {
    expect(() => maskSoottySvg(source, ["missing"])).to.throw(
      "Signals not found in sootty SVG: missing"
    );
  });
});
