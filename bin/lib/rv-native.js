"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const IMAGE = "vzpac-rv-exec:latest";
const DOCKERFILE = `FROM debian:12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc-riscv64-linux-gnu libc6-dev-riscv64-cross qemu-user-static && \\
    rm -rf /var/lib/apt/lists/*
WORKDIR /work
`;
let imageReady = false;

function ensureImage(opts = {}) {
  if (imageReady) return;
  const inspect = () => spawnSync("docker", ["image", "inspect", IMAGE], { stdio: "ignore" }).status === 0;
  if (!inspect()) {
    if (opts.verbose) console.error(`[rv-exec] building image ${IMAGE}`);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rv-exec-build-"));
    try {
      fs.writeFileSync(path.join(directory, "Dockerfile"), DOCKERFILE);
      const built = spawnSync("docker", ["build", "-t", IMAGE, directory], { stdio: "inherit" });
      if (built.status !== 0) throw new Error("docker build failed");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
  imageReady = true;
}

// Both rv-exec and ISA collections use this lifecycle. Programs run in separate
// processes, so their initialized globals and libc state cannot leak across runs.
function executeNative(sources, programs, opts = {}) {
  ensureImage(opts);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rv-exec-run-"));
  const container = `vzpac-rv-${crypto.randomBytes(10).toString("hex")}`;
  let completed = false;
  try {
    for (const [name, source] of Object.entries(sources)) {
      if (!/^[A-Za-z0-9_-]+\.(?:c|s)$/.test(name)) throw new Error(`invalid native source basename ${name}`);
      fs.writeFileSync(path.join(directory, name), source);
    }
    const commands = [];
    let seconds = 120;
    programs.forEach((program, index) => {
      const timeout = program.timeout === undefined ? 10 : program.timeout;
      if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 300) throw new Error("native timeout must be in (0, 300] seconds");
      if (!Array.isArray(program.sources) || !program.sources.length || program.sources.some(name => !Object.prototype.hasOwnProperty.call(sources, name))) {
        throw new Error("native program must select existing source files");
      }
      seconds += timeout;
      commands.push(`riscv64-linux-gnu-gcc -static -no-pie -O0 ${program.sources.map(name => `/work/${name}`).join(" ")} -o /work/exe-${index}`);
      commands.push(`timeout --signal=KILL ${timeout}s qemu-riscv64-static /work/exe-${index} > /work/stdout-${index} 2> /work/stderr-${index}`);
    });
    const result = spawnSync("docker", ["run", "--rm", "--name", container, "-v", `${directory}:/work`, IMAGE, "bash", "-c", commands.join(" && ")], {
      encoding: "utf8", timeout: seconds * 1000, maxBuffer: 16 * 1024 * 1024
    });
    if (result.error || result.status !== 0) {
      const diagnostics = programs.map((_, index) => {
        const filename = path.join(directory, `stderr-${index}`);
        return fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
      }).join("");
      throw new Error(`native execution failed${result.status === 124 || result.status === 137 || (result.error && result.error.code === "ETIMEDOUT") ? " (timeout)" : ""}: ${result.error ? result.error.message : `exit ${result.status}`}\n${result.stderr || ""}${diagnostics}`);
    }
    completed = true;
    return programs.map((_, index) => ({
      stdout: fs.readFileSync(path.join(directory, `stdout-${index}`), "utf8"),
      stderr: fs.readFileSync(path.join(directory, `stderr-${index}`), "utf8")
    }));
  } finally {
    if (!completed) spawnSync("docker", ["rm", "-f", container], { stdio: "ignore", timeout: 10000 });
    if (opts.keep) console.error(`[rv-exec] artifacts kept at ${directory}`);
    else fs.rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = { executeNative };
