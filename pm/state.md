# netlistsvg — State

Updated: 2026-10-28

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `netlistsvg-1sf.2` restores the existing lint baseline/stale CLI import; `netlistsvg-1sf.3` agrees and implements prediction semantics for the currently ignored `branchpred` flag.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-10-28 · Main

Done: pipeline collection backend for consumer `mc-ewm0.2`. Structured instruction/annotation data and shared YAML anchors feed the existing `pipe pipesim` machine; finite/steady CPI, throughput and comparisons derive from real timing. Shared inline collections preserve distributed example positions, forward references, quote nesting and asset-only variants. Numeric curried/comma/JSON programs parse without `eval`; obsolete pipeline snapshots/fixtures are removed in favor of Mocha behavior tests. Historical prediction semantics are deliberately unchanged.

State: changed-file ESLint and 136 behavioral cache/MMU/pipeline tests pass. The consumer's 30 emitted commands reproduce full state/table/180 artifacts; all 180 rebuilt PDF texts match. Extracted npm tarball generates both collections and executes all 30 commands. Changed registers/dependencies, policies, repeat/frequency, diagram/assembly controls, finite-vs-padded latency and reverse comparisons exercised. Consumer confirms 19 chapters/book/16 decks, SHA/source/PDF consistency, solution omission, missing-derived recovery, original markers/IDs/footnotes and actual Obsidian rendering. New unreachable-reference, physical-path and multibranch-boundary regressions were observed failing before their fixes and pass afterward.

Next: `netlistsvg-1sf.2` for the upstream gate; `netlistsvg-1sf.3` for prediction only after agreeing scientific behavior. Remaining family migrations stay in the consumer tracker; no further migration started.

Gotchas: steady-state periods come from corresponding completion times plus translation-invariant readiness, not speculative fetch. Whole-percent speedups are truncated after the exact period ratio. `branchpred` is currently ignored for timing; branch traces are explicit rather than interpreted control flow. Cache/MMU retain their canonical machines and earlier constraints. General `npm test` remains the known 106-lint-error/stale-import failure; not rerun or suppressed. Blockers: none for this migration.

