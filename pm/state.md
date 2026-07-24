# netlistsvg — State

Updated: 2026-07-24

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

None.

Parked: `netlistsvg-1sf` — generic bugs epic, no open children · legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-07-24 · Codex

Done: resolved and closed `netlistsvg-1sf.1` as a documentation clarification; reopened the generic `netlistsvg-1sf` bugs epic after auto-close. State: ADR 0001 now defines `state.vmin` as retained across an empty runqueue and distinguishes wakeup placement from the omitted no-current preemption comparison; no runtime code changed. Next: 1) process the next child added under `netlistsvg-1sf` 2) keep children sequential. Gotchas: the retained value is not the minimum of an empty set. Blockers: none.
