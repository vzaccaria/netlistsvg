# netlistsvg — State

Updated: 2026-07-24

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

1. `netlistsvg-1sf` — bugs. Correctness fixes for the teaching tools. Open: `netlistsvg-1sf.1` investigating the no-current-task scheduling case.

Parked: legacy `bin/TODO.md` items need triage; unrelated local work must remain untouched.

## Handoff

Written: 2026-07-24 · Codex

Done: opened and started `netlistsvg-1sf.1`. State: investigation starting; no code changed or verification run yet. Next: 1) reproduce the no-current-task scheduling error 2) fix the empty comparison set at its source 3) run the focused scheduling scenario. Gotchas: scheduling preemption math is documented in `pm/adr/0001-vz-sched-preemption-math.md`; preserve unrelated local changes. Blockers: none.
