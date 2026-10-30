# netlistsvg — State

Updated: 2026-10-30

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `.2` restores existing lint/stale CLI import; `.3` agrees prediction semantics; `.4` reviews initial CFS arrival deadline offset; `.5` reviews quantum expiration when slices are not timer-aligned. CFS timing changes require separate scientific agreement.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-10-30 · Main

Done: PAC `mc-ewm0.7` Quine/Karnaugh adapter, con OK FINALE ADVISOR: `kind: minimize` riusa la sintesi nativa, verifica la copertura sul dominio e deriva conteggi/tabelle/ritardi. Nessun cambiamento al tie-break del sintetizzatore.

State: ESLint dei file modificati e 346 test di dominio verdi. CLI reale su 23 istanze, confronto di 92 PDF nativi, variante tabella/fan-in/ritardi e PDF con/senza soluzione verificati. Build PAC completa, libro 270 pagine; PDF e Obsidian ispezionati.

Next: migrazione PAC sequenziale HDL `mc-ewm0.8`, poi FSM/ISA/calling convention, con gate ADVISOR per ogni bead. Bugs generici restano separati nel tracker locale.

Gotchas: `minimize` richiede vettore quotato di esattamente 2^n caratteri 01x, 1–6 variabili. Essenziali iniziali distinti da quelli successivi alla dominanza. Conteggio alternative minimo per termini, statistiche letterali separate; enumerazione limitata a un milione di nodi con errore esplicito. Correzioni PAC autorizzate in `mc-gei.7`: 8 ns e rimozione valore33 spurio. General `npm test` resta il guasto noto lint/import; non rieseguito o aggirato. CFS e `branchpred` invariati.

