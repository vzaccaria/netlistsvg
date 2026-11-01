# netlistsvg — State

Updated: 2026-11-01

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `.2` restores existing lint/stale CLI import; `.3` agrees prediction semantics; `.4` reviews initial CFS arrival deadline offset; `.5` reviews quantum expiration when slices are not timer-aligned. CFS timing changes require separate scientific agreement.
- `netlistsvg-sp2` — CLI vzpac strutturata per dominio/oggetto/verbo, con alias legacy silenziosi e permanenti. Mappa approvata dall'utente (ADR-0002 Accepted). Open: `.2` prova routing Caporal; `.3` registro/help/alias; `.4` migrazione caller e documentazione, incluso materiale-corsi e conversione cache.yml; `.5` verifica end-to-end e pubblicazione. Dipendenze sequenziali; revisione con ruolo opus o fable e OK esplicito obbligatori prima della chiusura di ogni bead.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-11-01 · Main

Done: `netlistsvg-sp2.1` chiuso: inventario (32 operazioni, 18 bin, 5 wrapper) e mappa canonica in ADR-0002, approvata esplicitamente dall'utente dopo due revisioni (raccolte cache unificate, dominio isa). Tre passaggi opus: BLOCKED→OK FINALE, delta BLOCKED su claim cache→OK FINALE dopo correzione.

State: ADR-0002 Accepted con allegati contratti/caller. Probe di fattibilità .2 già eseguiti su Caporal 0.8 installato: convivenza alias/canonici ok; `--` resta nei posizionali; `--format` richiede validatore; guard pre-Caporal per help legacy/percorsi ignoti provato (il predicato deve trattare i comandi noti come prefissi di argv).

Next: `.2` formalizzare la prova routing come test riproducibili (dispatch, `--`, flag globali, intercettazione metacomandi) e sottoporla al gate; poi `.3` registro/help/alias. Conversione cache.yml/slot capitolo 6 in `.4`.

Gotchas: parser Caporal 0.8.0, non 1.x. L'handler memory non accetta cache.yml così com'è: slot `%% memory-exercises %%` e `kind` obbligatorio; prefissi d'errore distinti ammessi. Cache classic/new foglie separate; pipe/pipe-new byte-identici. Standalone conservano la diagnostica attuale. Bug scientifici CFS/branchpred e guasto generale npm test restano separati.

