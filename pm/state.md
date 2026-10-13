# netlistsvg — State

Updated: 2026-10-13

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic; child `netlistsvg-1sf.2` restores the existing lint baseline and migrates the stale `test/test-all.js` CLI import.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-10-13 · Main

Done: cache extension tracked by `materiale-corsi` task `mc-x2pk`: canonical simulator supports two/four total blocks, actual ways, generated counts or exact binary traces, structured initial states and minimum replacement conflicts. Collection `params` backend and duplicate renderer replay removed; shared YAML anchors supported. Documentation updated.

State: 43 behavioral cache tests and changed-file ESLint pass. Extracted npm package reproduces all ten PAC instances; historical states and transitions preserved. Actual PAC build, notes/book/slides and expanded Obsidian preview verified in the consumer repository. Full `npm test` fails in unchanged files with 106 lint errors; its runtime leg separately fails on `../bin/netlistsvg`. These baseline failures are tracked in `netlistsvg-1sf.2`, not suppressed.

Next: restore the upstream gate via `netlistsvg-1sf.2`. Gotchas: explicit traces reject generation constraints; valid initial tag widths depend on geometry; identical seeds do not imply identical traces across organizations. Blockers: none for the cache extension.
