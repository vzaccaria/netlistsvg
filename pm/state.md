# netlistsvg — State

Updated: 2026-10-28

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `.2` restores existing lint/stale CLI import; `.3` agrees prediction semantics; `.4` reviews initial CFS arrival deadline offset; `.5` reviews quantum expiration when slices are not timer-aligned. CFS timing changes require separate scientific agreement.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-10-28 · Main

Done: CFS collection backend for consumer `mc-ewm0.3`. Native schedules/tasks and YAML anchors feed the existing CFS event loop and one artifact assembler; JSON/stdin CLI and all four artifact names remain supported. Generic `asset_name` separates directory IDs from basenames across all four family adapters. Scheduler snapshots/fixtures and unavailable Jest targets are replaced by installed Mocha behavior gates.

State: changed-file ESLint and 179 cache/MMU/pipeline/CFS tests pass. Sixteen CLI/API cases preserve full history/conditions/final schedules and 64 descriptors/TEX; all 64 rebuilt figure PDF texts match. Extracted npm package generates both collections and executes all 16 emitted commands. September initial order C→A→B and changed timer/weights/arrival/waits/order exercised; actual consumer builds 19 chapters, a 269-page book and 16 fingerprint-consistent decks.

Rendering-only delayed-arrival crash was observed failing, repaired with pending rows, and passes its regression. Consumer found wakeup-condition answers outside a split callout; fixed containment and proved actual PDF omission without solutions. Missing-derived recovery, incremental stability and actual PDF/Obsidian previews verified; unrelated cache/MMU/pipeline inputs and outputs unchanged.

Next: `.2` for upstream gates; `.3` for prediction, `.4` for initial arrival offsets and `.5` for non-grid quantum expiration only after scientific agreement with PAC `mc-gei`. Remaining family migrations stay in consumer tracker; no further migration started.

Gotchas: initial start deadlines remain relative to walltime=-timer; quantum expiration still uses exact equality, so rotating variants need timer-aligned slices. These native conventions are documented, not silently corrected. `initialrq` retains tie order and plotting indices; collection generation does not mutate shared data. General `npm test` remains the known 106-lint-error/stale-import failure; not rerun or suppressed. Blockers: none for this migration.

