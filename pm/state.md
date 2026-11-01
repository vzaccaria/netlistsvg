# netlistsvg — State

Updated: 2026-11-01

## Roadmap

Active (children + detail in bd; run `bd show <id>`):

- `netlistsvg-1sf` — generic bugs epic. Open: `.2` restores existing lint/stale CLI import; `.3` agrees prediction semantics; `.4` reviews initial CFS arrival deadline offset; `.5` reviews quantum expiration when slices are not timer-aligned; `.6` `memmap generate` needs python2 (absent). CFS timing changes require separate scientific agreement.

Parked: legacy `bin/TODO.md` items need triage · unrelated local work must remain untouched.

## Handoff

Written: 2026-11-01 · Main

Done: epic `netlistsvg-sp2` completato. `.5` ha verificato tutte le 32 righe di ADR-0002 (64 casi, 16 raccolte reali incluse GCC/QEMU), 18 bin e 5 wrapper, help e `help legacy`, ciclo build/cache/clean/fallimento, l'esame storico `20260724` con soli alias (identico al codice pre-riordino) e, a cura del reviewer, fallback del makefile e pipe wave→compile-artifacts. Gate opus OK FINALE su ogni bead.

State: CLI canonica `vzpac <dominio> <oggetto> <verbo>` in produzione; alias permanenti. Suite: test-domains 415, isa-native 13, fcall-native 10. Uniche differenze osservate: preesistenti (`memmap generate`, `.1sf.6`; `rv-fcall test` senza immagine `riscenv-latest`) o non deterministiche (ordine log con `VZPAC_JOBS=2`, testo estratto di un PDF LuaLaTeX).

Next: nessun lavoro residuo sull'epic. Operativo: `npm link` in questo repo per installare `vz-cache-new`, `vz-gen-assets`, `vz-rv-exec`, assenti dal link globale del 22/5. Nuovi esami PAC: skill `polimi-pac-exam`, partendo da `20260910`.

Gotchas: parser Caporal 0.8.0. `cache.yml` richiede `kind` per istanza e slot `%% memory-exercises %%`. Cache classic/new foglie separate. Help di foglia sugli alias mostra l'intestazione legacy (limite accettato). Un flag globale prima del percorso impedisce l'esecuzione anche sulle forme legacy. `exit` diverso per `fsm exercises` (1) e `sched exercises` (2) senza YAML: preesistente. `20260724/q-1.2/exe` è versionato e la build lo riscrive. Bug scientifici CFS/branchpred e guasto generale `npm test` restano separati.

