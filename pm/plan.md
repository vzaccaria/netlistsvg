# Development Plan

Last updated: 2026-06-03

## Active epics

### 1. vz-pipe-new short flag collision with shared compile options (`netlistsvg-n97`)

**Why:** shared `-c/--compile` collides with pre-existing `-c, --conflicts`
on vz-pipe and `-c, --is-vcd` on vz-wave. **Scope:** drop colliding short
flags. **Status:** vz-pipe done (`n97.1` closed); vz-wave pending
(`netlistsvg-n97.2`).

### 2. xelatex font controls for vz-* artifacts (`netlistsvg-3ti`)

**Why:** `--compile` pipeline only sets main font; verbatim/code blocks
inherit default monospace and clash with chosen main font.
**Scope:** extend `wrapTex` preamble + `registerCompileOptions` in
`bin/lib/artifacts.js`; thread option through `compileArtifactsXelatex`;
wire across vz-* CLIs that already accept `--font`. Out of scope:
listings/minted styling, language-specific highlighting.
**Status:** open. Child: `netlistsvg-3ti.1` (--font-mono flag).

## Parked / future

- Untracked WIP in `bin/lib/quine.js` (modified, not staged) — review and
  either commit or revert before opening new epics.
- Legacy notes in `bin/TODO.md` (2019 items: "Add tests for RV function
  call", "Remove unneeded tests"). Decide whether to migrate to beads or
  delete.

## Completed (recent)

- cache-new command tree for cache exercises (`netlistsvg-p0v`) —
  closed 2026-06-03. `cache-new config` generates seeded cache
  configuration exercises; `cache-new sim` generates seeded 4-block cache
  traces with exact or ranged hit-count control.
- Backfill packages for vz-cache artifacts (`netlistsvg-2q7`) —
  closed 2026-05-29. Trace artifacts now declare amssymb + xcolor;
  `vz-cache sim ... -c` produces all 5 PDFs.
- Backfill packages/tikzLibraries for vz-pipe artifacts
  (`netlistsvg-afb`) — closed 2026-05-29. `latexArtifact()` + `wrapTex`
  now accept a `preamble` field; vz-pipe artifacts declare tikz +
  shapes.geometric/positioning/calc/matrix and inline
  `bin/preambles/pipe.tex` where needed.
- compile-to-pdf for vz-* artifacts (`netlistsvg-6qo`) — closed
  2026-05-22. `latexArtifact()` now carries per-artifact
  `packages` / `tikzLibraries`; new `compileArtifactsXelatex` runs
  xelatex+pdfcrop in a tmp dir so only the final `<pfx>-<sfx>.pdf`
  lands in cwd. `-c/--compile` and `--font` wired across
  sched / quine / fsm / cache / mmu / wave / pipe pipesim / rv-fcall
  artifact. Packages backfilled for quine, rv-fcall, sched.
- vzpac unified CLI (`netlistsvg-c0o`) — closed 2026-05-22. New
  `bin/vzpac.js` dispatcher; each `bin/vz-*.js` exports `register(prog)`
  and self-injects its SUBNAME when run standalone. `package.json`
  exposes `vzpac` alongside all existing `vz-*` entries.
- vz-sched scheduling correctness (`netlistsvg-yr5`) — closed 2026-05-22.
  Both bugs resolved (`yr5.1` formula, `yr5.2` vmin invariant verified).
  See `pm/adr/0001-vz-sched-preemption-math.md`.
- vz-sched artifacts & presentation (`netlistsvg-3l0`) — closed
  2026-05-22. New `printConditions` LaTeX artifact wired into
  `saveIt` via shared `wakeupV` helper.
- Repo PM bootstrap (`bare` layout) — 2026-05-22.
