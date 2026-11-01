# netlistsvg — State

Updated: 2026-11-01

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `.2` restores existing lint/stale CLI import; `.3` agrees prediction semantics; `.4` reviews initial CFS arrival deadline offset; `.5` reviews quantum expiration when slices are not timer-aligned. CFS timing changes require separate scientific agreement.
- `netlistsvg-sp2` — CLI vzpac strutturata per dominio/oggetto/verbo, con alias legacy silenziosi e permanenti. Mappa approvata (ADR-0002 Accepted); registro e migrazione chiamanti completati. Open: `.5` verifica end-to-end di tutte le righe/bin/wrapper e pubblicazione finale. Revisione opus o fable con OK esplicito obbligatoria prima della chiusura.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-11-01 · Main

Done: `netlistsvg-sp2.4` chiuso: emitter `bin/lib/*/exercises.js`, README e pm/readme sui percorsi canonici; in materiale-corsi makefile asset (21 ricette, fallback, 4 build), cinque manifest mantenuti, `cache.yml` con `kind: cache` e slot `%% memory-exercises %%`, esame `20260910`, doc PAC e ADR-001/002; skill `polimi-pac-exam` (tabella canonica, `20260910` come sorgente, fonti Markdown/YAML) e `polimi-pac-rv-asm`. Gate opus: BLOCKED su doc/skill, corretti, poi OK FINALE.

State: test-domains 415 passing; esame 20260910 ricostruito da zero, 12 pagine pixel-identiche; build PAC completa (37 min) con 87 PDF pubblicati identici in testo e pagine e capitoli generati identici salvo slot intermedio; un hash di testo FSM differisce per non-determinismo LuaLaTeX riprodotto anche con il comando legacy.

Next: `.5` confronto old/new per ogni riga della mappa, 18 bin e 5 wrapper, stream (stdin sched/wave, redirect asm), un esame storico con alias (es. 20260724), build/cache-hit/clean/fallimento di un manifest. Documentare la differenza preesistente exit 1 (`fsm exercises` senza YAML) vs 2 (`sched exercises`).

Gotchas: parser Caporal 0.8.0, non 1.x. L'handler memory non accetta cache.yml così com'è: slot `%% memory-exercises %%` e `kind` obbligatorio; prefissi d'errore distinti ammessi. Cache classic/new foglie separate; pipe/pipe-new byte-identici. Standalone conservano la diagnostica attuale. Bug scientifici CFS/branchpred e guasto generale npm test restano separati.

