# netlistsvg — State

Updated: 2026-11-01

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `.2` restores existing lint/stale CLI import; `.3` agrees prediction semantics; `.4` reviews initial CFS arrival deadline offset; `.5` reviews quantum expiration when slices are not timer-aligned. CFS timing changes require separate scientific agreement.
- `netlistsvg-sp2` — CLI vzpac strutturata per dominio/oggetto/verbo, con alias legacy silenziosi e permanenti. Mappa approvata dall'utente (ADR-0002 Accepted); `.3` registro/help/alias implementato. Open: `.4` migrazione caller e documentazione, incluso materiale-corsi e conversione cache.yml; `.5` verifica end-to-end e pubblicazione. Revisione con ruolo opus o fable e OK esplicito obbligatori prima della chiusura di ogni bead.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-11-01 · Main

Done: `netlistsvg-sp2.3` chiuso: `bin/lib/cli-map.js` (24 alias via `Command.alias()` sullo stesso oggetto, 7 foglie custom con azioni esportate da vz-sched/vz-fsm/vz-rv-fcall/vz-pipe/vz-memmap, guard con help gerarchico, `help legacy`, completion canonica, flag globali scavalcati) collegato in `vzpac.js` solo nel main; 13 test in `cli-map.test.js`. Gate opus: BLOCKED su 4 difetti (completion rotta, candidati legacy, globali che aggiravano la diagnostica, logica sched/fsm copiata), corretti, poi OK FINALE con smoke proprio del reviewer.

State: suite 415 passing, 13 pending; eslint pulito; standalone e wrapper invariati (smoke). Limiti accettati registrati in ADR: help/errori di foglia aliased con intestazione legacy; flag globale in testa impedisce già l'esecuzione anche sulle forme legacy (tokenizer micromist, non regressione).

Next: `.4` migrare i chiamanti ai nomi canonici: 21 ricette + fallback e 4 gen-assets nel makefile assets PAC, cinque manifest mantenuti, conversione `cache.yml` (kind per istanza) e slot `%% memory-exercises %%` in notes.6, emitter in bin/lib/*/exercises.js, README/pm. Poi `.5` verifica end-to-end (nota: `fsm exercises` senza YAML esce 1, `sched exercises` 2 — differenza preesistente da documentare nel confronto).

Gotchas: parser Caporal 0.8.0, non 1.x. L'handler memory non accetta cache.yml così com'è: slot `%% memory-exercises %%` e `kind` obbligatorio; prefissi d'errore distinti ammessi. Cache classic/new foglie separate; pipe/pipe-new byte-identici. Standalone conservano la diagnostica attuale. Bug scientifici CFS/branchpred e guasto generale npm test restano separati.

