# netlistsvg — State

Updated: 2026-10-28

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `.2` restores existing lint/stale CLI import; `.3` agrees prediction semantics; `.4` reviews initial CFS arrival deadline offset; `.5` reviews quantum expiration when slices are not timer-aligned. CFS timing changes require separate scientific agreement.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-10-28 · Main

Done: memory collection backend for PAC `mc-ewm0.5`. Mixed inline `kind: latency|address|cache` instances compute thresholds/address geometry or reuse the existing cache adapter; one chapter and combined manifest preserve original positions and artifact names. Analytical sizing supports 32 blocks independently of simulation limits.

State: changed-file ESLint and all 214 cache/MMU/pipeline/CFS/memory behavior tests pass. Four cache cases preserve all 26 action/state transitions and 20 rebuilt PDF texts; address wave text unchanged. Existing seven collections and September exam unchanged. Extracted npm package generates and compiles three changed cases, including actual figures through apostrophe/space/shell-bearing output paths without injection. Classic wave conversion and shared pdfcrop now use argv for these paths.

Actual consumer builds 19 chapters, a 269-page book and 16 fingerprint-consistent decks. Missing new outputs recover with stamps present; all 16 derived outputs then retain exact bytes/timestamps. Real no-solutions PDF omits all three quantitative answers; PDF/Obsidian previews verified. Consumer renderer block-callout defect repaired upstream as `vz-clitools-bo7` (47 renderer regressions pass).

Next: `.2` for upstream gates; `.3` for prediction, `.4` for initial arrival offsets and `.5` for non-grid quantum expiration only after scientific agreement with PAC `mc-gei`. Remaining family migrations stay in consumer tracker; no further migration started.

Gotchas: PAC intentionally preserves its contradictory latency prompts/solutions (`mc-gei.3`); no scientific change in this migration. Initial CFS start deadlines remain relative to walltime=-timer and quantum expiration uses exact equality. Generic `mdbook` URL decoding defect for percent-encoded local images is tracked separately as `vz-clitools-8it`; canonical consumer paths unaffected. General `npm test` remains the known 106-lint-error/stale-import failure; not rerun or suppressed. Blockers: none for this migration.

