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
- `vzpac cache exercises <yaml> -o <chapter.md> --manifest <assets.yml>` projects YAML instances and a Markdown family into a complete chapter and a `gen-assets` manifest. It neither simulates nor compiles: `vzpac gen-assets` reuses `cache sim`, and `mdbook` receives ordinary Markdown.
- `bin/fixtures/` and `test/` contain vz-tool fixtures and upstream tests.

Keep topic behavior in its domain package; put only genuinely cross-cutting
CLI and artifact support in shared helpers.

## Build & test

- Install: `npm install`.
- Upstream tests and lint: `npm test`.
- vz-tool checks: `node bin/test.js`, `node bin/testbatches.js`,
  `bash bin/testcache.sh`.
- Cache exercise boundary tests: `./node_modules/.bin/mocha bin/lib/vz-cache/exercises.test.js`; lint changed cache files with the existing ESLint configuration.
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
- Cache collections reference `template`, `chapter`, `base_assets` relative to their YAML and provide `tag` plus ordered `sections[].exercises[]`. Instances have `id`, optional `intro`, and `params` (`membits`, `blockbits`, `cachesizebits`, log2 `cacheways`, quoted binary `accesses`, optional structured `initial`).
- Family templates carry default `intro` in YAML frontmatter and use `${id}`, `${intro}`, `${tag}`, `${assets}`, `${source}`. The source chapter has one `%% cache-exercises %%` slot; base assets retain their original directories. Outputs use write-if-changed and must not overwrite inputs.
- Generated Markdown rebases links from the physical output directory, preserving image destinations through directory symlinks (including macOS `/var` → `/private/var`).
- Use explicit accesses, not random offsets. The legacy direct-mapped simulator requires at least one index bit; the collection command reports that limitation rather than silently changing the configuration.
- Compile-capable CLIs share `--font`, `--font-mono`, and artifact compilation
  helpers; `\setmonofont` is emitted only when requested.
- Preserve unrelated local changes.
