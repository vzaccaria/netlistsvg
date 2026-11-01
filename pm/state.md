# netlistsvg — State

Updated: 2026-11-01

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `.2` restores existing lint/stale CLI import; `.3` agrees prediction semantics; `.4` reviews initial CFS arrival deadline offset; `.5` reviews quantum expiration when slices are not timer-aligned. CFS timing changes require separate scientific agreement.
- `netlistsvg-sp2` — CLI vzpac strutturata per dominio/oggetto/verbo, con alias legacy silenziosi e permanenti. Open: `.1` inventario e mappa da approvare con utente; `.2` prova routing Caporal; `.3` registro/help/alias; `.4` migrazione caller e documentazione, incluso materiale-corsi; `.5` verifica end-to-end e pubblicazione. Dipendenze sequenziali; revisione con ruolo opus o fable e OK esplicito obbligatori prima della chiusura di ogni bead.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-11-01 · Main

Done: creata epic `netlistsvg-sp2` con cinque figli, criteri di accettazione, dipendenze e gate opus/fable su ciascun bead. Nessun bead chiuso e nessuna modifica alla CLI.

State: pianificazione registrata; la tassonomia discussa resta proposta. La precedente migrazione dichiarativa PAC `mc-ewm0` è completata, inclusi ISA e rv-fcall.

Next: iniziare `netlistsvg-sp2.1`, censire tutta la superficie pubblica e sottoporre la mappa completa all'utente. L'approvazione della mappa precede l'implementazione; il gate opus/fable non la sostituisce. Registrare piano revisionato, rilievi risolti ed evidenze prima di ogni chiusura.

Gotchas: Caporal 1 presenta shadowing fra comandi parent e annidati; verificare prima il routing. `cache sim` e `cache-new sim` hanno motori distinti: nessun alias che cambi semantica. Preservare standalone, stdin/stream, default, exit code e artefatti legacy. Bug scientifici CFS/branchpred e guasto generale `npm test` restano separati.

