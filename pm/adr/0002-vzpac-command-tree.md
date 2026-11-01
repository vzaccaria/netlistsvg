# ADR-0002 — CLI vzpac gerarchica con compatibilità legacy

Status: Proposed — richiede approvazione utente della mappa e revisione opus/fable.
Epic: `netlistsvg-sp2`; inventario: `netlistsvg-sp2.1`.

## Contratto

Grammatica canonica: `vzpac <dominio> <oggetto> <verbo>`. I gruppi sono `logic`, `cpu`, `memory`, `os`, `graphics`, `build`. `graphics` sostituisce il provvisorio gruppo `render`: il dominio è un nome, l'ultima parola è un verbo. `generate` materializza una raccolta dichiarativa YAML; simulazioni singole, rendering e emissione di sorgenti hanno verbi distinti. Help/version sono metacomandi, non operazioni didattiche.

Nessuna modifica ai motori, ai dati o alla semantica scientifica. Handler condivisi da percorsi canonici e alias; nessun subprocess di inoltro e nessuna copia della logica. Alias legacy silenziosi e senza scadenza, inclusi i nomi standalone e le invocazioni dirette dei wrapper correnti. Le opzioni esistenti, i default, gli argomenti, stdin/stdout/stderr, directory relative, nomi dei file e codici d'uscita delle invocazioni legacy valide restano invariati. Non uniformare flag brevi fra comandi: `-c` può significare compile oppure clean.

## Mappa completa proposta

Prefisso `vzpac` omesso. Il resto di argv resta invariato salvo i selettori espliciti indicati. La mappa è una proposta, non un'interfaccia già implementata.

| Attuale | Canonico proposto |
|---|---|
| `netlist` | `logic netlist render` |
| `logic exercises` | `logic combinational generate` |
| `quine` | `logic combinational minimize` |
| `seq exercises` | `logic sequential generate` |
| `fsm` (file oppure stdin) | `logic fsm synthesize` |
| `fsm exercises` | `logic fsm generate` |
| `isa exercises` | `cpu isa generate` |
| `rv-exec` | `cpu isa run` |
| `rv-fcall exercises` | `cpu functions generate` |
| `rv-fcall asm` | `cpu functions emit --format asm` |
| `rv-fcall artifact` | `cpu functions render` |
| `rv-fcall diagram` | `cpu stack render` |
| `rv-fcall test` | `cpu functions test` |
| `pipe exercises` | `cpu pipeline generate` |
| `pipe pipesim` | `cpu pipeline simulate` |
| `pipe preamble` | `cpu pipeline emit --format latex-preamble` |
| `memory exercises` | `memory cache generate` |
| `cache exercises` | `memory cache generate` (schema ridotto) |
| `cache-new config` | `memory cache configure` |
| `cache-new sim` | `memory cache simulate` |
| `cache sim` | `memory cache-classic simulate` |
| `mmu exercises` | `memory paging generate` |
| `mmu sim` | `memory paging simulate` |
| `memmap generate` | `memory map render` |
| `memmap preamble` | `memory map emit --format latex-preamble` |
| `sched` (file oppure stdin) | `os scheduling simulate` |
| `sched exercises` | `os scheduling generate` |
| `wave` | `graphics waveform render` |
| `sootty mask` | `graphics waveform mask` |
| `nomnom` | `graphics diagram render` |
| `gen-assets` | `build assets generate` |
| `compile-artifacts` | `build artifacts compile` |

Cache: due foglie di simulazione distinte, una registrazione/opzioni/default per motore. `memory cache simulate` usa esattamente cache-new; `memory cache-classic simulate` usa il vecchio cache sim. Nessun selettore `--engine`; gli emitter usano esplicitamente la foglia cache corrente. `-w` resta numero di vie nel nuovo motore ed esponente in quello classico.

Raccolte cache unificate: verificato nel codice, `memory exercises` è un sovrainsieme di `cache exercises` — i kind sono `latency`, `address` e `cache`, tutti sulle cache, e il kind `cache` delega allo stesso generatore della raccolta cache. La foglia canonica `memory cache generate` usa l'handler memory (kind obbligatorio per istanza). L'alias `cache exercises` conserva il proprio schema ridotto senza `kind:`; non diventa un errore né viene riscritto. `memory problems` è abbandonato: nessuna raccolta eterogenea da nascondere dietro un nome vago.

`cpu functions emit` emette solo assembly, con JSON obbligatorio e `--section` default full; valori sconosciuti della section ricadono attualmente su full e restano così. `cpu functions render` usa esattamente artifact, incluse compilazione e dichiarazione JSON opzionale: il percorso stdin attuale fallisce su `path.resolve(args.json)` e non viene corretto qui. `cpu stack render` conserva il diverso handler diagram, inclusi output ispezionato con `-j` e il suffisso testuale `true` del ramo nonblank.

I tre comandi emit hanno un solo formato ciascuno: asm per functions, latex-preamble per pipeline/map. `--format` è opzionale, default al solo formato supportato; un valore diverso o ripetuto fallisce exit 2. Non è un dispatch fra handler. È riconosciuto dalla normale registrazione Caporal, anche in forma `--format=...`, e segue le regole esistenti per posizione e `--`; non viene estratto né riordinato da argv. Gli alias non acquisiscono questa opzione nuova. I due preamble non richiedono input. `memory map render` legge CSV; configure genera un esercizio cache, non modifica configurazioni globali.

Sched/FSM: estrarre azioni operative condivise, non riusare il dispatch implicito come azione canonica. Solo gli alias conservano la riserva `exercises`, il secondo argomento YAML e tutte le opzioni parent accettate/ignorate. Le foglie canoniche simulate/synthesize hanno solo `[json]`, le proprie opzioni operative e nessun `-o/--output` o `--manifest`: un file chiamato `exercises` è un normale file. Le foglie generate accettano solo `<yml>`, output e manifest obbligatori al parsing, exit 2 se mancanti, come le altre otto raccolte. Errori del parser canonico nominano il percorso canonico; diagnostica dei vecchi dispatch invariata. I messaggi dei motori condivisi non vengono riscritti. È una separazione di routing, non una copia o modifica dei motori.

## Superficie legacy

`package.json` dichiara 18 nomi installati: `vzpac`, `netlistsvg`, `vz-netlist`, `vz-sched`, `vz-compile-artifacts`, `vz-wave`, `vz-quine`, `vz-pipe`, `vz-pipe-new`, `vz-fsm`, `vz-memmap`, `vz-nomnom`, `vz-rv-fcall`, `vz-cache.js`, `vz-cache-new`, `vz-mmu`, `vz-gen-assets`, `vz-rv-exec`. Conservarli tutti; non inventare un bin installato `vz-cache` privo del suffisso `.js`.

`netlistsvg` e `vz-netlist` sono lo stesso ingresso. `vz-pipe.js` e `vz-pipe-new.js` sono attualmente byte-identici e usano lo stesso backend: non sono due motori pipeline. Conservare entrambi i nomi, non aggiungere un motore fittizio. Conservare anche gli ingressi diretti `node bin/vz-{memory,logic,seq,isa,sootty}.js`, senza introdurre nuovi bin installati in questa attività.

I vecchi `bin/vz-fcall.js` e `bin/vz-src.js`, estranei al dispatcher e ai package bin, restano intatti e fuori dalla migrazione; non sono alias del nuovo rv-fcall. Vecchi riferimenti upstream a `bin/netlistsvg` inesistente e flag storici già non supportati non diventano nuove API per effetto del riordino. La deriva esistente dei bin in package-lock va considerata se si toccano i metadati package, senza aggiornamenti indiscriminati delle dipendenze.

## Help, routing e compatibilità diagnostica

Help iniziale: soli gruppi canonici; help intermedio: oggetti/operazioni pertinenti; help foglia: argomenti e opzioni del singolo handler. `help legacy` elenca le 32 corrispondenze, i 18 bin e i cinque wrapper diretti correnti; identifica i tre script fuori scope senza attribuire loro nuovi alias. Vecchie forme di help continuano a funzionare e possono indicare il percorso canonico nella pagina, senza warning durante l'esecuzione.

Parser dichiarato e installato: Caporal **0.8.0**, verificato a runtime. L'help principale espone 30 operazioni; `sched exercises` e `fsm exercises` sono due dispatch impliciti aggiuntivi (32 operazioni totali). Sono stati eseguiti gli help delle 32 forme e dei 18 bin installati: tutti exit 0, non prova di esecuzione dei motori. Attualmente `cpu --help` e un comando inesistente restituiscono help generale ed exit 0; `sched exercises --help` non espone un help foglia autonomo. Non assumere che exit 0 provi l'esistenza di un sottocomando.

Diagnostica proposta per il solo ingresso `vzpac`: nessun argomento, gruppo valido (`logic`) o oggetto valido (`logic fsm`) mostrano il relativo help su stdout, exit 0; percorsi inesistenti falliscono con diagnostica su stderr ed exit 2, anche con `--help` oppure `help <percorso-inesistente>`. Help/version/completion validi mantengono le proprie regole. Le foglie legacy riconosciute mantengono parsing/errori del proprio handler; un suffisso aggiuntivo è un argomento da validare, non automaticamente un percorso ignoto. I 17 standalone e cinque wrapper diretti conservano anche l'attuale comportamento dei percorsi inesistenti (help/exit 0). Nessuna modifica agli script fuori scope. Queste differenze canoniche e il nonzero sui percorsi vzpac ignoti richiedono approvazione insieme alla mappa. Il bead .2 prova `--`, flag globali, ordine opzioni e routing senza sostituire preventivamente Caporal.

## Confini della migrazione dei chiamanti

- `netlistsvg`: registrazioni e wrapper; emitter in `bin/lib/vz-{cache,mmu,pipe,sched,memory,logic,seq,fsm,rv-fcall}/exercises.js`; test che eseguono gli emitter; README e documentazione operativa. ISA verifica durante generate: non inventare un job differito rv-exec.
- `materiale-corsi`: 21 ricette di raccolta e relativi fallback in `pac/courses/common/assets/makefile`, quattro invocazioni gen-assets; cinque manifest mantenuti `1_rl_seq/base-assets.yml`, `3_arch_mem/base-assets.yml`, `2_isa_intro/assets.yml`, `3_arch_pipe/assets.yml`, `3_arch_os/assets.yml`; documentazione corrente; SSOT/makefile dell'esame `20260910` come consumatore corrente rappresentativo.
- Rigenerare manifest/capitoli ignorati da Git dai rispettivi proprietari. Non modificare i derivati a mano. Shake orchestra il makefile e preserva MMU→cache/CFS, FSM→seq, fcall→ISA; non introdurre un secondo dispatch in Haskell.
- Esami precedenti (fra cui `20260724`, `20260723`, `20260629`) e Org delle vecchie edizioni restano invariati come consumatori legacy. Non riscrivere gli archivi. `sootty`, `cairosvg`, Icarus, `vz` e tool Polimi esterni non fanno parte di questa CLI.
- Preservare quoting, pipe, redirect assembly e `$selfdir`, cwd e prefissi. I manifest statici hanno limiti di quoting preesistenti: nessuna promessa nuova di sicurezza generale dei path. Il cambio di comando negli emitter invalida naturalmente gli hash degli asset.

## Verifiche richieste prima della chiusura dell'epic

1. Ogni riga della mappa: invocazioni old/new sul medesimo input deterministico, confronto dati/file/stream/exit e diagnostica prevista; niente soli test di wiring o snapshot dell'help.
2. Tutti i bin installati e wrapper diretti correnti; sched/FSM file/stdin/collection; opzioni prima/dopo argomenti, `--`, globali e selettori.
3. Cache classic e bounded distinte; pipeline standard e alias pipe-new sullo stesso motore.
4. Eseguire i comandi emessi da ogni famiglia e la composizione fcall→ISA; smoke di un fallback con output mancante.
5. Esame corrente 20260910 con nuovi nomi; un esame mantenuto con standalone legacy; assembly su stdout e wave→compile-artifacts via pipe.
6. Manifest reale: build, cache-hit, invalidazione, clean e fallimento senza stamp di successo. Ripetere i casi di path/quoting già supportati, senza allargare il contratto.
7. Build PAC completa di note/libro/slide sui percorsi canonici. Artefatti confrontati semanticamente quando i PDF includono metadati non deterministici.

## Gate e sequenza

`.1` inventario/mappa → `.2` prova routing → `.3` registro/help/alias → `.4` chiamanti/documentazione → `.5` verifica/pubblicazione. La mappa richiede OK esplicito dell'utente prima di chiudere .1 e iniziare .2. Ogni bead richiede inoltre revisione del piano e del risultato con ruolo **opus oppure fable**, rilievi risolti ed OK esplicito annotato; vale anche per l'epic. Nessuna chiusura sulla sola design review di un risultato non ancora verificato.

## Allegati e metacomandi

- [Inventario completo dei contratti](0002-cli-contract-inventory.md): argomenti, tutte le opzioni/default, stream, file, motori, errori e particolarità del parser, con riferimenti alle sorgenti. È evidenza statica, non prova runtime dei motori.
- [Inventario dei chiamanti](0002-cli-consumer-inventory.md): proprietari, percorsi attivi/storici, emitter e scenari di accettazione.
- Preservare anche i metacomandi Caporal `completion <bash|zsh|fish>` e `completion --`, `help`, version e i flag nativi `--color/--no-color`, `--quiet`, `--silent`, verbose. La nuova completion deve proporre i percorsi canonici; gli alias restano eseguibili.
- `bin/view.js` è un ulteriore ingresso diretto fuori dispatcher/package: resta invariato, insieme a `vz-src.js` e `vz-fcall.js`.

## Revisione

Ruolo opus: primo esame BLOCKED per quattro ambiguità (dispatch sched/FSM, foglie con handler diversi, diagnostica dei percorsi, default dei preamble). Risolte separando le foglie e precisando i contratti sopra. Riesame: **OK FINALE**, inventario/proposta pronti per approvazione utente; nessuna approvazione dell'implementazione futura.

Chiarimenti non bloccanti del riesame: anche i prefissi legacy senza azione (`vzpac pipe`, `vzpac cache`, `vzpac rv-fcall`, `vzpac help pipe`) diventano percorsi ignoti con exit 2; esplicitarlo nell'approvazione e nell'help legacy. Help dei gruppi canonici esclude gli alias, elencati in help legacy. Il bead .2 deve provare l'intercettazione dei metacomandi prima di Caporal per help legacy e help di percorsi inesistenti.
