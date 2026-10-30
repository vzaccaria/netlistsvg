# netlistsvg — State

Updated: 2026-10-30

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `.2` restores existing lint/stale CLI import; `.3` agrees prediction semantics; `.4` reviews initial CFS arrival deadline offset; `.5` reviews quantum expiration when slices are not timer-aligned. CFS timing changes require separate scientific agreement.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-10-30 · Main

Done: Boolean collection backend for PAC `mc-ewm0.6`: one bounded AST model drives truth tables, verified proof steps, AND/OR costs and native simple/aig netlists. Shared collection support preserves multiple historical artifact directories and rebases their image paths for external variants.

State: changed-file ESLint and all 332 domain tests pass. Consumer parity covers 25 exercises plus one asset-only bus mux, 13 historical RTL/PDF diagrams and 176 exhaustive RTL vectors. Extracted npm package CLI/gen-assets exercise changed Boolean inputs and arithmetic divisor without manual answer copies.

Actual consumer builds 19 chapters, a 270-page book and 16 fingerprint-consistent decks. All 25 exercise families filter answers correctly in actual PDFs; PDF/Obsidian previews verified. Four missing derivatives recover; all 20 derived outputs preserve bytes/mtimes incrementally.

Next: `.2` for upstream gates; `.3` for prediction, `.4` for initial arrival offsets and `.5` for non-grid quantum expiration only after scientific agreement with PAC `mc-gei`. Remaining migrations stay in consumer tracker; Karnaugh/Quine migration not started.

Gotchas: Boolean costs exclude NOT/wiring; binary fan-in counts differ from n-input gates. No automatic minimizer or inferred encoder assumptions. Consumer preserves the historical zero exclusion in its multiples-of-four table pending `mc-gei.6`. CFS timing conventions and separate `mdbook` URL defect remain unchanged. General `npm test` remains the known lint/stale-import failure; not rerun or suppressed. Blockers: none.

