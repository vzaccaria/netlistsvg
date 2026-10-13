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
- `vzpac cache exercises <yaml> -o <chapter.md> --manifest <assets.yml>` projects one-line YAML instances and a Markdown family into a complete chapter and a `gen-assets` manifest. Every instance uses `cache-new sim`, for generated counts or explicit traces. The simulator owns canonical cache states; the renderer does not replay transitions. Compilation remains in `gen-assets`; `mdbook` receives ordinary Markdown.
- `bin/fixtures/` and `test/` contain vz-tool fixtures and upstream tests.

Keep topic behavior in its domain package; put only genuinely cross-cutting
CLI and artifact support in shared helpers.

## Build & test

- Install: `npm install`.
- Upstream tests and lint: `npm test`.
- vz-tool checks: `node bin/test.js`, `node bin/testbatches.js`,
  `bash bin/testcache.sh`.
- Cache behavior and collection boundaries: `./node_modules/.bin/mocha bin/lib/vz-cache/sim.test.js bin/lib/vz-cache/exercises.test.js`; lint changed cache files with the existing ESLint configuration.
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
- Cache collections reference `template`, `chapter`, `base_assets` relative to their YAML and provide `tag` plus ordered `sections[].exercises[]`. Every instance has `id`, optional `intro`, and `generate`; old `params` is removed. One-line example: `- {id: intro, generate: {blocks: 2, ways: 1, membits: 8, blockbits: 4, accesses: 6, hits: 2, conflicts: 1}}`.
- `generate`: `blocks` is total blocks (2/4, default 4); `ways` is actual associativity dividing blocks, not log2. `membits` is address width (up to 52), `blockbits` is log2 bytes/block (0 allowed); cache cannot exceed memory and tags must have positive width. Omitted dimensions/ways are seeded. `seed` defaults to ID; fix it explicitly before renaming. Numeric `accesses` defaults to six; `hits` or `minHits`/`maxHits` constrain generated hits; `conflicts` is a minimum of misses replacing a full set. Generated misses use fresh tags and feasible set coverage; hits change the previous block offset when possible. Infeasible constraints fail, never silently weaken.
- Array `accesses` contains quoted binary addresses (spaces/leading zeros preserved) and requires explicit `membits`/`blockbits`; `hits`, `minHits`, `maxHits`, `conflicts` are forbidden. Define named arrays once under `traces` with `&name`, reuse `accesses: *name`; arrays are never mutated. Optional `initial` is a flat set-major/way-major array of exactly `blocks` entries `{valid: boolean, tag: quoted binary, data: integer}`, also shareable by anchor. Valid tag widths depend on geometry; invalid short tags/data are preserved. LRU starts tied at zero, fills first invalid slot, then evicts the oldest (ties first slot).
- CLI: `cache-new sim --blocks 2 --ways 1 --accesses 6 --hits 2 --conflicts 1`; explicit `--trace='["00000000","00100000","00000001"]' --membits 8 --blockbits 4` replaces `--accesses`; `--initial` takes a JSON array. A populated initial cache may hit on its first access. Constrain dimensions/ways and reuse an actual trace for comparisons: equal seeds alone do not guarantee equal accesses across organizations.
- Family templates carry default `intro` in YAML frontmatter and use `${id}`, `${intro}`, `${tag}`, `${assets}`, `${source}`. The source chapter has one `%% cache-exercises %%` slot; base assets retain their original directories. Outputs use write-if-changed and must not overwrite inputs.
- Generated Markdown rebases links from the physical output directory, preserving image destinations through directory symlinks (including macOS `/var` → `/private/var`).
- Legacy `cache sim` remains an independent CLI, not a collection backend. Collections preserve historical supplied traces/initial states through the canonical simulator; unknown options and malformed cases fail before replacing either output.
- Compile-capable CLIs share `--font`, `--font-mono`, and artifact compilation
  helpers; `\setmonofont` is emitted only when requested.
- Preserve unrelated local changes.
