# Development Plan

Last updated: 2026-05-22

## Active epics

None.

## Parked / future

- Untracked WIP in `bin/lib/quine.js` (modified, not staged) — review and
  either commit or revert before opening new epics.
- Legacy notes in `bin/TODO.md` (2019 items: "Add tests for RV function
  call", "Remove unneeded tests"). Decide whether to migrate to beads or
  delete.

## Completed (recent)

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
