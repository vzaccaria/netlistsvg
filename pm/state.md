# netlistsvg — State

Updated: 2026-11-01

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `.2` restores existing lint/stale CLI import; `.3` agrees prediction semantics; `.4` reviews initial CFS arrival deadline offset; `.5` reviews quantum expiration when slices are not timer-aligned. CFS timing changes require separate scientific agreement.
- `netlistsvg-sp2` — CLI vzpac strutturata per dominio/oggetto/verbo, con alias legacy silenziosi e permanenti. Open: `.1` inventario e mappa da approvare con utente; `.2` prova routing Caporal; `.3` registro/help/alias; `.4` migrazione caller e documentazione, incluso materiale-corsi; `.5` verifica end-to-end e pubblicazione. Dipendenze sequenziali; revisione con ruolo opus o fable e OK esplicito obbligatori prima della chiusura di ogni bead.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-11-01 · Main

Done: inventario e proposta `netlistsvg-sp2.1` in ADR-0002 con contratti e chiamanti allegati. Revisione opus: quattro rilievi risolti, poi OK FINALE. Nessuna modifica alla CLI e nessun bead chiuso.

State: 32 operazioni, 18 bin e cinque wrapper diretti censiti. Eseguiti gli help delle 32 forme e dei 18 bin; verificato Caporal 0.8.0. Mappa ancora Proposed, in attesa dell'approvazione utente.

Next: ottenere approvazione della mappa completa e della diagnostica exit 2 per percorsi vzpac ignoti; solo dopo chiudere .1 e iniziare la prova routing .2. Gate opus/fable resta obbligatorio su ogni bead.

Gotchas: parser Caporal 0.8.0, non 1.x. Cache classic/new hanno contratti diversi e foglie separate; pipe/pipe-new sono byte-identici. Preservare anche particolarità/errori legacy, non correggerli implicitamente. Standalone conservano la diagnostica attuale. Bug scientifici CFS/branchpred e guasto generale npm test restano separati.

