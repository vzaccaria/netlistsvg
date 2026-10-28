# netlistsvg — State

Updated: 2026-10-28

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic; child `netlistsvg-1sf.2` restores the existing lint baseline and migrates the stale `test/test-all.js` CLI import.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-10-28 · Main

Done: MMU collection backend for `materiale-corsi` task `mc-ewm0.4`: structured process/page traces, explicit geometry/policy/cutoff, compact instances and shared YAML anchors. `mmu sim` and collections use one simulator; the five legacy artifacts remain unchanged. Cache and MMU reuse the collection engine for templates, validation, physical-path rebasing and optional base assets. MMU comparison counts/operators are computed, including ties and FIFO winning; optional commentary remains instance-specific. A visually discovered footnote-definition rebasing bug is fixed with a failing-before/passing-after regression.

State: changed-file ESLint and 79 behavioral cache/MMU tests pass. Extracted npm package generates both PAC MMU collections plus cache composition; all four emitted MMU commands reproduce 20 historical artifacts. Consumer confirms unchanged text in all 20 MMU PDFs, all ten cache results and 16 other OS jobs; parameter variations, solution omission, missing-derived recovery, full notes/book/16-deck build and actual Obsidian preview verified. All eight OS footnotes preserved. General `npm test` remains a known pre-existing failure (106 lint errors; stale `../bin/netlistsvg` runtime import), tracked in `netlistsvg-1sf.2`; not rerun or suppressed here.

Next: restore the upstream gate via `netlistsvg-1sf.2`; remaining PAC family migrations stay in the consumer tracker. Gotchas: MMU cutoff zero intentionally hides init, replacement is process-local, and geometry must fit all working sets; do not add another simulator to the renderer. Cache explicit traces still reject generation constraints, and identical seeds do not imply identical traces across organizations. Blockers: none for this migration.
