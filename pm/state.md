# netlistsvg — State

Updated: 2026-11-01

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `.2` restores existing lint/stale CLI import; `.3` agrees prediction semantics; `.4` reviews initial CFS arrival deadline offset; `.5` reviews quantum expiration when slices are not timer-aligned. CFS timing changes require separate scientific agreement.
- `netlistsvg-sp2` — CLI vzpac strutturata per dominio/oggetto/verbo, con alias legacy silenziosi e permanenti. Mappa approvata dall'utente (ADR-0002 Accepted). Open: `.3` registro/help/alias; `.4` migrazione caller e documentazione, incluso materiale-corsi e conversione cache.yml; `.5` verifica end-to-end e pubblicazione. Dipendenze sequenziali; revisione con ruolo opus o fable e OK esplicito obbligatori prima della chiusura di ogni bead.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-11-01 · Main

Done: `netlistsvg-sp2.2` chiuso: prova di routing riproducibile su Caporal 0.8 in `bin/lib/routing-probe.js` + `bin/lib/routing.test.js` (14 test, inclusi in `test-domains`). Gate opus: BLOCKED su tre difetti (help su percorsi ignoti, gate GROUPS, semantica `--`), corretti, poi OK FINALE. Suite completa: 402 passing, 13 pending.

State: fatti provati per `.3`: convivenza alias/canonici; opzioni prima/dopo posizionali; `--` termina il parsing ma resta posizionale letterale; `--format` monovalore via validatore (ripetuto → `Invalid value 'asm,asm'`); guard pre-Caporal con validità decisa solo dalle tabelle comandi (prefissi validi solo canonici: `pipe` nudo exit 2, `cpu` help exit 0; `help legacy`/`help <ignoto>` intercettati).

Next: `.3` registro centrale, help gerarchico e alias reali in vzpac.js, riusando la semantica del probe; decidere il trattamento dei flag globali prima del percorso (oggi bypassano il guard). Poi `.4` caller e conversione cache.yml/slot capitolo 6.

Gotchas: parser Caporal 0.8.0, non 1.x. L'handler memory non accetta cache.yml così com'è: slot `%% memory-exercises %%` e `kind` obbligatorio; prefissi d'errore distinti ammessi. Cache classic/new foglie separate; pipe/pipe-new byte-identici. Standalone conservano la diagnostica attuale. Bug scientifici CFS/branchpred e guasto generale npm test restano separati.

