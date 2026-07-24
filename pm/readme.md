# netlistsvg (vz fork)

## Purpose

Fork of `nturley/netlistsvg` with `vz-*` teaching tools for computer
architecture and advanced operating-systems courses. It renders Yosys netlists
and generates didactic diagrams, traces, exercises, and LaTeX artifacts.

## Architecture

- `lib/` contains the upstream netlist-to-SVG renderer and skins.
- `bin/vz-*.js` contains the topic-specific CLIs and the `vzpac` dispatcher.
- `bin/lib/` contains shared CLI, artifact, TeX, and topic-domain logic,
  including the scheduling, pipeline, and cache engines.
- `bin/fixtures/` and `test/` contain vz-tool fixtures and upstream tests.

Keep topic behavior in its domain package; put only genuinely cross-cutting
CLI and artifact support in shared helpers.

## Build & test

- Install: `npm install`.
- Upstream tests and lint: `npm test`.
- vz-tool checks: `node bin/test.js`, `node bin/testbatches.js`,
  `bash bin/testcache.sh`.
- Build demo: `npm run build-demo`.
- Run a CLI directly with `node bin/<file>.js` or through its package `bin`.

## Conventions

- Scheduling preemption invariants are documented in
  `pm/adr/0001-vz-sched-preemption-math.md`.
- LaTeX artifacts target math-mode rendering.
- Wavedrom delegates to standard `wavedrom-cli`.
- Checked-in snapshots and fixtures belong under their existing topic folder.
- `vz-cache-new` exercise generation remains separate from legacy
  `vz-cache sim`.
- Compile-capable CLIs share `--font`, `--font-mono`, and artifact compilation
  helpers; `\setmonofont` is emitted only when requested.
- Preserve unrelated local changes.
