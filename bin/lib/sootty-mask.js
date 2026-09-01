"use strict";

const onml = require("onml");
const DEFAULT_MASK_FILL = "#171717";

const parseNumber = (value, description) => {
  const result = Number.parseFloat(value);
  if (!Number.isFinite(result)) {
    throw new Error(`Invalid ${description}: ${value}`);
  }
  return result;
};

const formatNumber = value => `${value}`;

const maskSoottySvg = (source, requestedSignals) => {
  const svg = onml.parse(source);
  if (
    !Array.isArray(svg) ||
    svg[0] !== "svg" ||
    !svg[1] ||
    typeof svg[1] !== "object" ||
    !svg[1].viewBox
  ) {
    throw new Error("Input is not a sootty SVG with a viewBox");
  }

  const viewBox = svg[1].viewBox
    .trim()
    .split(/\s+/)
    .map(value => parseNumber(value, "viewBox"));
  if (viewBox.length !== 4) {
    throw new Error(`Invalid viewBox: ${svg[1].viewBox}`);
  }

  const elements = svg.filter(Array.isArray);
  const lines = elements.filter(element => element[0] === "line");
  if (lines.length === 0) {
    throw new Error("Input contains no waveform lines");
  }

  const plotX = lines.reduce(
    (minimum, line) =>
      Math.min(
        minimum,
        parseNumber(line[1].x1, "line x1"),
        parseNumber(line[1].x2, "line x2")
      ),
    Infinity
  );
  const background = elements.find(element => element[0] === "rect");
  if (!background || !background[1].fill) {
    throw new Error("Input contains no filled background rectangle");
  }

  const labels = new Map();
  elements
    .filter(element => element[0] === "text")
    .forEach(element => {
      const x = parseNumber(element[1].x, "text x");
      const text = element.slice(2).filter(value => typeof value === "string").join("");
      if (x < plotX) {
        labels.set(text, parseNumber(element[1].y, `label ${text} y`));
      }
    });

  const signals = Array.from(
    new Set(requestedSignals.map(signal => signal.trim()).filter(Boolean))
  );
  if (signals.length === 0) {
    throw new Error("At least one signal must be masked");
  }

  const missing = signals.filter(signal => !labels.has(signal));
  if (missing.length !== 0) {
    throw new Error(`Signals not found in sootty SVG: ${missing.join(", ")}`);
  }

  const maskX = plotX - 1;
  const viewRight = viewBox[0] + viewBox[2];
  signals.forEach(signal => {
    const baseline = labels.get(signal);
    svg.push([
      "rect",
      {
        x: formatNumber(maskX),
        y: formatNumber(baseline - 18),
        width: formatNumber(viewRight - maskX),
        height: "26",
        fill: DEFAULT_MASK_FILL
      }
    ]);
  });

  return onml.stringify(svg);
};

module.exports = { maskSoottySvg };
