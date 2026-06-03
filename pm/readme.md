# netlistsvg (vz fork)

## Purpose

Fork of `nturley/netlistsvg` extended with `vz-*` CLI tools used for teaching
computer architecture / advanced OS courses. Original tool renders SVG
schematics from Yosys JSON netlists via elkjs. Fork adds didactic generators
for pipeline simulation, scheduling diagrams, FSMs, caches, MMU, memory maps,
quine-McCluskey minimization, wavedrom timing diagrams, and RISC-V traces.

## Architecture

- `lib/` — upstream netlistsvg renderer (`index.js`) plus SVG skins
  (`default.svg`, `analog.svg`, `vz-default*.svg`).
- `bin/` — `vz-*` entry points, one CLI per topic:
  - `vz-netlist.js` — netlistsvg wrapper.
  - `vz-sched.js` — instruction scheduling / pipeline diagrams (LaTeX out).
  - `vz-pipe.js` (`vz-pipe-new.js` symlink) — pipeline simulation + traces.
  - `vz-cache.js` — cache simulation.
  - `vz-cache-new.js` — cache exercise generation.
  - `vz-mmu.js`, `vz-memmap.js` — MMU / memory map diagrams.
  - `vz-fsm.js` — FSM diagrams.
  - `vz-quine.js` — Quine-McCluskey minimization.
  - `vz-wave.js` — wavedrom wrapper (uses standard `wavedrom-cli`).
  - `vz-rv-fcall.js`, `vz-nomnom.js`, `vz-compile-artifacts.js`.
- `bin/lib/` — shared modules: `common.js`, `quine.js`, `qmc.js`, `fsm.js`,
  `spim.js`, `tex.js`, `artifacts.js`, plus `vz-cache/`, `vz-pipe/`, and
  `vz-sched/` subpackages.
- `bin/fixtures/` — per-tool fixtures (`cache/`, `cache-new/`, `fsm/`,
  `memmap/`, `mmu/`, `pipe/`, `quine/`, `riscv/`, `wave/`).
- `bin/test.js`, `bin/testartifacts.js`, `bin/testbatches.js`,
  `bin/testcache.sh` — test entry points for the vz tools.
- `test/` — upstream netlistsvg tests (`test-all.js`).
- `demo/` — browser demo bundle.

## Build & Run

- Install: `npm install`.
- Upstream tests + lint: `npm test` (eslint + `test/test-all.js`).
- vz tool tests: `node bin/test.js`, `node bin/testbatches.js`,
  `bash bin/testcache.sh`.
- Build demo: `npm run build-demo`.
- CLIs are exposed via `package.json` `bin` entries (run via
  `npx <name>` after install, or directly `node bin/<file>.js`).

## Key conventions

- Each `vz-*` tool is self-contained; shared helpers live in `bin/lib/`.
- LaTeX output (e.g. `vz-sched`) targets math-mode rendering — see commit
  `824a179` for symbol/env handling.
- Wavedrom integration delegates to the standard `wavedrom-cli` (commit
  `9c03489`); do not reintroduce a custom path.
- Snapshots and fixtures are checked in under `bin/fixtures/` and
  `bin/lib/vz-*` subfolders.
- `vz-cache-new` keeps exercise generation separate from legacy
  `vz-cache sim`; `config` emits cache-configuration questions and `sim`
  emits 4-block cache traces with generated hit/miss solutions rendered in
  the legacy block-state table format.
- Commit style: short `verb(scope): subject`, frequently
  `update: minor changes (<files>)` for incremental tweaks.
