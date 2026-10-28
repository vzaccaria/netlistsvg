# netlistsvg (vz fork)

## Purpose

Fork of `nturley/netlistsvg` with `vz-*` teaching tools for computer architecture and advanced operating-systems courses. It renders Yosys netlists and generates didactic diagrams, traces, exercises, and LaTeX artifacts.

## Architecture

- `lib/` contains the upstream netlist-to-SVG renderer and skins.
- `bin/vz-*.js` contains the topic-specific CLIs and the `vzpac` dispatcher.
- `bin/lib/` contains shared CLI, artifact, TeX, and topic-domain logic,
  including the scheduling, pipeline, cache, and MMU engines.
- `vzpac cache exercises <yaml> -o <chapter.md> --manifest <assets.yml>` projects one-line YAML instances and a Markdown family into a complete chapter and a `gen-assets` manifest. Every instance uses `cache-new sim`, for generated counts or explicit traces. The simulator owns canonical cache states; the renderer does not replay transitions. Compilation remains in `gen-assets`; `mdbook` receives ordinary Markdown.
- `vzpac mmu exercises <yaml> -o <chapter.md> --manifest <assets.yml>` uses the same collection engine with structured process/page traces. `mmu sim` and collections share one MMU state machine; both policies, complete/blank tables and configuration retain the five historical artifact names.
- `vzpac pipe exercises <yaml> -o <chapter.md> --manifest <assets.yml>` uses that collection engine with structured instruction traces and the canonical `pipe pipesim` machine. Questions, schedules, finite/steady CPI, throughput and policy comparisons share those data; all six legacy artifact names remain stable.
- `bin/fixtures/` and `test/` contain vz-tool fixtures and upstream tests.

Keep topic behavior in its domain package; put only genuinely cross-cutting CLI and artifact support in shared helpers.

## Build & test

- Install: `npm install`.
- Upstream tests and lint: `npm test`.
- vz-tool checks: `node bin/test.js`, `node bin/testbatches.js`,
  `bash bin/testcache.sh`.
- Domain behavior/collection gates: `./node_modules/.bin/mocha bin/lib/vz-cache/{sim,exercises}.test.js bin/lib/vz-mmu/{sim,exercises}.test.js bin/lib/vz-pipe/{lib,model,exercises}.test.js`. Lint changed files with the existing ESLint configuration.
- Build demo: `npm run build-demo`.
- Run a CLI directly with `node bin/<file>.js` or through its package `bin`.

## Conventions

- Scheduling preemption invariants are documented in `pm/adr/0001-vz-sched-preemption-math.md`.
- LaTeX artifacts target math-mode rendering.
- Wavedrom delegates to standard `wavedrom-cli`.
- Checked-in snapshots and fixtures belong under their existing topic folder.
- `vz-cache-new` exercise generation remains separate from legacy `vz-cache sim`.
- Cache collections reference `template`, `chapter`, `base_assets` relative to their YAML and provide `tag` plus ordered `sections[].exercises[]`. Every instance has `id`, optional `intro`, and `generate`; old `params` is removed. One-line example: `- {id: intro, generate: {blocks: 2, ways: 1, membits: 8, blockbits: 4, accesses: 6, hits: 2, conflicts: 1}}`.
- `generate`: `blocks` is total blocks (2/4, default 4); `ways` is actual associativity dividing blocks, not log2. `membits` is address width (up to 52), `blockbits` is log2 bytes/block (0 allowed); cache cannot exceed memory and tags must have positive width. Omitted dimensions/ways are seeded. `seed` defaults to ID; fix it explicitly before renaming. Numeric `accesses` defaults to six; `hits` or `minHits`/`maxHits` constrain generated hits; `conflicts` is a minimum of misses replacing a full set. Generated misses use fresh tags and feasible set coverage; hits change the previous block offset when possible. Infeasible constraints fail, never silently weaken.
- Array `accesses` contains quoted binary addresses (spaces/leading zeros preserved) and requires explicit `membits`/`blockbits`; `hits`, `minHits`, `maxHits`, `conflicts` are forbidden. Define named arrays once under `traces` with `&name`, reuse `accesses: *name`; arrays are never mutated. Optional `initial` is a flat set-major/way-major array of exactly `blocks` entries `{valid: boolean, tag: quoted binary, data: integer}`, also shareable by anchor. Valid tag widths depend on geometry; invalid short tags/data are preserved. LRU starts tied at zero, fills first invalid slot, then evicts the oldest (ties first slot).
- CLI: `cache-new sim --blocks 2 --ways 1 --accesses 6 --hits 2 --conflicts 1`; explicit `--trace='["00000000","00100000","00000001"]' --membits 8 --blockbits 4` replaces `--accesses`; `--initial` takes a JSON array. A populated initial cache may hit on its first access. Constrain dimensions/ways and reuse an actual trace for comparisons: equal seeds alone do not guarantee equal accesses across organizations.
- Family templates carry default `intro` in YAML frontmatter and use `${id}`, `${intro}`, `${tag}`, `${assets}`, `${source}`, and optional per-instance `${commentary}`. Intro/commentary placeholders are resolved before insertion. Chapters have one `%% cache-exercises %%` or `%% mmu-exercises %%` slot. `base_assets` is optional; existing asset directories are retained. Section `level` defaults to 2. Outputs use write-if-changed and must not overwrite inputs; malformed inputs are rejected before replacing either output.
- Generated Markdown rebases links from the physical output directory, preserving image destinations through directory symlinks (including macOS `/var` → `/private/var`).
- `mode: inline` replaces the single chapter slot with `${case.exercise}`, `${case.assets}` and namespaced model values at their original positions. Document/section/instance templates override in order; `template: null` is asset-only. Cross-instance references may point forward; missing, cyclic or unreferenced instances fail before writes. Multiline interpolation preserves quote depth; static links resolve from their source, generated destinations are not rebased twice.
- Pipeline `generate` uses `instructions: [{op: lw, d: 1, s1: 10}, …]`, optional `repeat`, `fw`, `branchopt`, `branchpred`, `maxCycles`, `isLoop`, `asmIns`, `noInstructions`, `hrowsep`, and structured `conflicts: [{type: c, from: {instruction: 0, stage: w}, to: {instruction: 1, stage: d}}]`; indices are zero-based. `comparison` overrides policies on the same body; `frequencyMHz` defaults to 600. Bounds: 256 expanded instructions, 4096 cycles, 262144 cells; steady-state metrics require repeated bodies ending in `beq`, at most 64 instructions and translation-invariant readiness within eight copies. Speedup uses unrounded periods and truncates whole percentages. CLI accepts curried/comma numeric programs and structured JSON without `eval`; registers are 0..31. `branchpred` is historically ignored for timing (`netlistsvg-1sf.3`); traces are explicit, not interpreted branch control flow.
- Legacy `cache sim` remains an independent CLI, not a collection backend. Collections preserve historical supplied traces/initial states through the canonical simulator; unknown options and malformed cases fail before replacing either output.
- MMU `generate` requires `processes`, `accesses: [{process: p, npv: 0}, …]`, integer `npvbits`/`npfbits`/`wsbits` (log2), `upto`, and `policy: LRU|FIFO`; named YAML anchors may share process/trace arrays. Process names are lowercase letters; page numbers are zero-based integers. Working sets cannot exceed virtual memory or combined physical capacity. Eviction is process-local and allocation chooses the lowest free frame.
- MMU `upto` is inclusive; `-1` shows the whole solution and legacy `0` hides even the initial answers. Validation caps dimensions at 16 bits, accesses at 10,000, and retained state cells at 1,000,000 before page-table allocation. MMU templates additionally expose `${policy}`, `${policyLower}`, `${faultsLRU}`, `${faultsFIFO}`, `${faultRelation}`, `${faultOperator}`; relation/operator compare FIFO against LRU, including equality and FIFO winning. Optional `commentary` is instance-specific prose, not a computed claim.
- Compile-capable CLIs share `--font`, `--font-mono`, and artifact compilation helpers; `\setmonofont` is emitted only when requested.
- Preserve unrelated local changes.
