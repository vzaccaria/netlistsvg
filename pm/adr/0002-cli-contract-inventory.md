# Static CLI contract matrix

Scope: current files under ../netlistsvg. Everything below is source evidence, not runtime verification. No edits or execution. Natural successful exit=0 and uncaught Node exception outcomes are [INFERENCE]; explicit parser/error exits are identified separately.

## 1. Exhaustive entrypoint accounting

`bin/vzpac.js:11-32` loads, in order: vz-netlist, vz-sched, vz-pipe, vz-cache, vz-cache-new, vz-mmu, vz-memmap, vz-memory, vz-logic, vz-seq, vz-fsm, vz-isa, vz-quine, vz-wave, vz-sootty, vz-rv-fcall, vz-nomnom, vz-compile-artifacts, vz-gen-assets, vz-rv-exec.

These define **30 registered actions**. Counting `sched exercises` and `fsm exercises` as the distinct public semantic operations they are gives **32 operations**. Neither implicit branch is a separately registered Caporal command.

All **18** package executable names (`package.json:43-62`):

| Package bin | Standalone arguments correspond to |
|---|---|
| vzpac | Full matrix below |
| netlistsvg | vzpac netlist ... |
| vz-netlist | vzpac netlist ... |
| vz-sched | vzpac sched ... |
| vz-compile-artifacts | vzpac compile-artifacts ... |
| vz-wave | vzpac wave ... |
| vz-quine | vzpac quine ... |
| vz-pipe | vzpac pipe ... |
| vz-pipe-new | Same pipe registrations/engine, standalone only; NOT a vzpac pipe-new domain |
| vz-fsm | vzpac fsm ... |
| vz-memmap | vzpac memmap ... |
| vz-nomnom | vzpac nomnom ... |
| vz-rv-fcall | vzpac rv-fcall ... |
| **vz-cache.js** | vzpac cache ...; `.js` is part of the installed executable name |
| vz-cache-new | vzpac cache-new ... |
| vz-mmu | vzpac mmu ... |
| vz-gen-assets | vzpac gen-assets ... |
| vz-rv-exec | vzpac rv-exec ... |

Direct scripts that ARE loaded into vzpac but are NOT package-exported: `node bin/vz-memory.js exercises ...`, `node bin/vz-logic.js exercises ...`, `node bin/vz-seq.js exercises ...`, `node bin/vz-isa.js exercises ...`, and `node bin/vz-sootty.js mask ...`. Each prepends its family token in its require.main block.

Direct CLI scripts that are neither package-exported nor loaded into vzpac: `bin/vz-fcall.js`, `bin/vz-src.js`; adjacent `bin/view.js` also exposes a direct default CLI. Their contracts are listed in §6. Do not conflate the existence of a script with an installed binary.

Most family standalone wrappers prepend SUBNAME before parsing. Consequently a caller supplies `vz-pipe pipesim ...`, not `vz-pipe pipe pipesim ...`. The direct-only MIPS/source scripts instead parse their subcommands directly. Standalone wrappers do not explicitly set the package version; only vzpac sets `.version(pkg.version || "0.0.0")`.

## 2. Shared contracts and exit/stream notation

### Shared artifact option set C

Exactly these options are added by `bin/lib/artifacts.js:245-260`:
- `-c, --compile`: no explicit default; compile when truthy.
- `--font <name>`: default **Minion Pro**.
- `--font-mono <name>`: no default.

C is attached to: sched, fsm, pipe pipesim, cache sim, cache-new config, cache-new sim, mmu sim, quine, wave, rv-fcall artifact. The implicit sched/fsm collection branches accept the same options because they share their parent registration, but ignore the artifact-specific options.

C does not independently select an output destination. With these commands, `--compile` is only honored in their save branch. Without `--save`, commands retain their ordinary stdout behavior even if `-c` is supplied.

`latexArtifact` produces `{code, clss, name, sfx, engine, addoptions, packages, tikzLibraries, preamble}`; `sfx=lodash.kebabCase(name)`, defaults clss=standalone, engine=pdflatex, packages/libraries=[], preamble="" (`artifacts.js:10-38`). JSON omits undefined fields.

Saving without C's compile writes raw code to `<save>-<sfx>.tex`, logging `Saving <filename>` to **stdout**. It does not create missing output directories. Compiling with C uses xelatex, except an artifact whose engine is exactly lualatex uses lualatex; wraps the code with fontspec/geometry, packages/libraries/preamble, runs with `-shell-escape`, crops via pdfcrop, leaves only `<save>-<sfx>.pdf` beside the requested prefix, and cleans temporary working files. It logs engine invocations to stdout. It does NOT produce `<save>-all.pdf`. Evidence: `artifacts.js:40-43,199-242`.

The *different* legacy compiler used by compile-artifacts/view saves `<prefix>-<sfx>.tex`, executes `tikz2pdf` with each artifact's stored class/engine/addoptions, concatenates individual PDFs using pdftk into `<prefix>-all.pdf`, then removes individual PDFs but leaves .tex files. Logs commands to stdout (`artifacts.js:46-87`). Both compiler families cap jobs using positive `VZPAC_JOBS`, default 2 (`:56-77`).

### Exit/stream categories used below

- **P**: Caporal argument-count/unknown-option/required-option/type-validation failure explicitly logs an error and exits **2** (`node_modules/caporal/lib/program.js:87-89,156-164`). Applies to every CLI registration.
- **R**: a rejected Promise returned by the action is caught by Caporal and exits **2** (`lib/command.js:400-414`). Async action functions are in this class.
- **S**: action does synchronous work/throws before returning. Caporal invokes the action before constructing its Promise; synchronous exceptions escape that catch. Normal Node exception failure is [INFERENCE], not a measured exit here.
- **D**: async work started but not returned/awaited. Its errors do not follow R; actual unhandled-rejection behavior is Node/runtime-dependent and is not asserted here.
- **W**: waveform awaited conversion/read errors explicitly print via console.error and set process.exitCode=**1**.

There is no general stdout purity guarantee: direct console.log calls, save/compile progress, logger info/debug, `--show-sigs`, and `--debug` can contaminate machine-readable streams. Caporal's transport sends errors/warnings to stderr and info/debug to stdout (`node_modules/caporal/lib/logger.js:13-22`). `--quiet`/`--silent` change the logger only, not console output.

For optional input paths, stdin means **omit the positional argument**. None of these file readers special-cases literal `-` as stdin.

## 3. Non-collection command matrix

Default `unset` below means no default is registered; do not replace that with a new explicit false/value during migration without checking serialization and branch behavior.

### netlist [file]
Evidence: `bin/vz-netlist.js:18-143`, registration `:99-125`.
- Arguments: optional file; omitted => stdin text.
- Options: `-o/--output <filename>` unset; `--script` STRING default `prep -auto-top` (source synopsis has no `<value>`); `--simple`; `--aig`; `--skin <filename>` STRING default `${__dirname}/../lib/vz-default.svg`; `-w/--watch`; `-k/--keep`; `-p/--open`; `-x/--ff-indices <list>` STRING; `-i/--ilang`.
- Engine: Yosys -> netlist JSON -> skin/lib.render -> CairoSVG PDF. Despite the argument description saying Verilog or JSON, this implementation always goes through Yosys; do not introduce JSON autodetection as part of renaming. `--aig` sets `prep -flatten -auto-top; aigmap`; then `--simple` sets `prep -flatten -auto-top; simplemap`, so simple wins if both are supplied. Both override custom script. ilang changes Yosys loading flags.
- Output: PDF to explicit output, else `path.basename(file, '.v') + '.pdf'` in cwd, else `output.pdf`. No diagram on stdout. Logs rendering progress; watch prints `Watching ...` and watches the original input file; open launches the resulting file. keep retains temp inputs/netlist.
- Errors: D; outer rejection is caught and logger.error'ed without setting an exit code. Yosys rejection is intentionally logged at info and suppressed before attempting JSON rendering. Preserve this distinction from strict failure commands.

### sched [json] [yaml] (ordinary scheduler mode)
Evidence: `bin/vz-sched.js:13-35`; `bin/lib/vz-sched/lib.js:32-258,561-626`.
- Optional JSON file, omitted => stdin JSON. `yaml` is only meaningful for implicit exercises mode.
- Options: `-s/--save <string>`; `-w/--draw`; `-n/--num <int>` INT default **9**; `-o/--output <markdown>`; `--manifest <yaml>`; C.
- Engine: current CFS eventLoop; it is not a generic scheduler selector.
- Output without save: pretty JSON of the **history array**. The implementation attaches `.latex` and `.conditions` as named array properties; [INFERENCE from JSON.stringify array semantics] these named properties are not included in ordinary JSON serialization. Do not silently turn stdout into `{history,latex}`.
- Save suffixes: `rt-diagram`, `rt-diagram-blank`, `data-table`, `wakeup-conditions`.
- `--draw` and `--num` are registered but not consumed to change native scheduler generation/output. They are not equivalent to FSM's draw mode.
- If not exercises mode, any second positional, truthy output, or truthy manifest throws `Use sched exercises ... for collections`. R.

### pipe pipesim <program>
Evidence: `bin/vz-pipe.js:10-41`; `bin/lib/vz-pipe/program.js:1-143`; `bin/lib/vz-pipe/lib.js:1-20,332-434`.
- Required inline program; no stdin/file reading. Restricted instruction-call string or JSON array encoded in the argument. Operations: add/sub/or(d,s1,s2), lw(d,s1), sw(s1,s2), beq(s1,s2), nop(), anything(). Registers 0..31; bounded 1..256 instructions; renderer bounded to 4096 cycles and 262144 cells.
- Options: `-s/--save <prefix>`; `-f/--fw`; `--branchpred`; `--branchopt`; `-b/--blank`; `-o/--no-instructions`; `-n/--max-cycles <integer>` (no parser validator); `--is-loop`; `--asm-ins <integer>` INT; `--conflicts <string>`; `-d/--debug`; `--hrowsep <double>` default **1.3**, specified using nonexistent `prog.DOUBLE` (normalization in program.js handles numeric strings); C.
- Normalizer bounds maxCycles 1..4096, asmIns 0..instruction count, hrowsep finite (0,100]. Conflict annotations are comma-separated c/d/f plus stage+instruction endpoints, e.g. the grammar `([cdf])([idemw])(\d+)([idemw])(\d+)`, not cache conflict counts.
- Output: pretty JSON `{state, table, latex}`; debug prepends simulator type and text trace to stdout. Save suffixes: `pipe-sim-complete`, `pipe-sim-blank`, `pipe-hazards-complete`, `pipe-hazards-blank`, `asm-code`, `description`.
- Engine is shared run/simulate in lib/vz-pipe/lib.js. fw and branchopt affect timing. branchpred is stored in state.config as hasBranchPrediction but not read to alter timing. blank is accepted/validated but output always includes both blank and complete artifacts; do not implement a new blank-only behavior as an alias migration. R.

### pipe preamble
No args/options/stdin; stdout contents of bin/preambles/pipe.tex; no file output; D. `bin/vz-pipe.js:43-47`.

### cache sim <alist> — LEGACY engine
Evidence: `bin/vz-cache.js:173-253,284-467`.
- Required comma-separated binary-address list; no stdin.
- Options: `-x/--save <prefix>`; `-m/--membits <num>` INT **14**; `-w/--cacheways <num>` INT **0**; `-b/--blockbits <num>` INT **9**; `-s/--cachesizebits <num>` INT **11**; `-d/--dont-simulate`; `-j/--json`; `--simplesim <varlist>`; `--t0 <tag>`; `--t1 <tag>`; `--i0 <index>`; `--i1 <index>`; `-e/--empty <string>`; C.
- cacheways is **log2(ways)**, with 0 meaning direct mapped. Size formula: indexbits=cachesizebits-blockbits-cacheways. Cold cache defaults to invalid slots. empty is comma-separated valid,tag,data triplets, chunked into slots, valid/data parsed as integers. Addresses must match membits after spaces are stripped.
- simplesim maps symbolic tag.index references using **t0,i0,t1,i1** supplied in its own value and generates random block-offset bits. The four separate t0/t1/i0/i1 options are accepted but never consumed.
- `--json` wins over save/compile/dont-simulate: prints pretty trace `{accesslist,results:{cache,actions}}`. It still simulates when dont-simulate is also supplied. Otherwise stdout compact `{latex}` or save via shared helper. dont-simulate bypasses simulation only in artifact mode, yielding artifacts with no trace actions.
- Artifact suffixes: `badge`, `cache-data`, `cache-data-blank`, `complete-trace`, `blank-trace`.
- Associative replacement uses least lastaccess; direct-mapped path differs. This implementation lives inline in vz-cache.js and is NOT lib/vz-cache/sim.js. Action is async, but its artifact-producing Promise is not returned/awaited: synchronous simulation errors => R, asynchronous save/compile errors => D.

### cache-new config
Evidence: `bin/vz-cache-new.js:19-117`; `bin/lib/vz-cache/config.js:5-138`.
- No positional arguments/stdin.
- Options: `--seed <value>`; `-x/--save <prefix>`; `-m/--membits <num>` INT; `-b/--blockbits <num>` INT; `-i/--indexbits <num>` INT; `-w/--ways <num>` INT; `-s/--cachesizebits <num>` INT; C. No numeric CLI defaults.
- Engine generates a seeded candidate configuration. Unconstrained ranges: membits **10..20**, blockbits **2..10**, indexbits **0..5**, associativity exponents **0..2** (actual ways 1/2/4). Explicit constraints replace those ranges, subject to generator validity; ways is an actual positive power-of-two count, NOT an exponent. Seed defaults to Date.now() as a string.
- stdout compact `{config,latex}`; saved suffixes `cache-configuration-exercise`, `cache-configuration-solution`. R.

### cache-new sim
Evidence: `bin/vz-cache-new.js:119-153`; `bin/lib/vz-cache/sim.js:25-59,126-237`; renderer `:154-212`.
- No positional arguments/stdin.
- Options: `--seed <value>`; `-x/--save <prefix>`; `--blocks <num>` INT effective default **4** (only 2/4); `-n/--accesses <num>` INT effective default **6**; `--trace <json>`; `--initial <json>`; `--hits <num>` INT; `--min-hits <num>` INT; `--max-hits <num>` INT; `--conflicts <num>` INT effective default **0** minimum replacement misses; `-m/--membits <num>` INT; `-b/--blockbits <num>` INT; `-w/--ways <num>` INT; C.
- Ways defaults to a seeded choice among divisors 1/2[/4] of blocks; blockbits defaults to seeded 2..10; membits defaults to seeded 10..20, adjusted upward for explicitly large blockbits/index needs. Address width <=52; cache must fit memory. Seed defaults to Date.now() string.
- trace must parse to a nonempty JSON array of quoted binary addresses; requires membits and blockbits. trace + accesses is explicitly rejected. Explicit traces reject hits/minHits/maxHits/conflicts. initial JSON must contain exactly blocks entries; supplied entries require boolean valid, binary-string tag and safe-integer data, including invalid entries; valid tags must have exact tag width and be unique within a set. Default unsupplied initial cache is all invalid.
- Generated hit count: exact hits overrides the min/max range when present, not a mutual-exclusion error. Without exact target, minHits defaults 0 and maxHits to accesses minus a compulsory cold first miss (or accesses if initially populated). Generator enforces feasible hit/conflict budgets.
- stdout compact `{simulation,latex}`. simulation includes seed/config/initial/constraints/counts/trace/results. Saved suffixes are legacy five above PLUS `combined-blank`, `combined-complete`. R.

### mmu sim <alist>
Evidence: `bin/vz-mmu.js:15-87`; `bin/lib/vz-mmu/sim.js:160-184`.
- Required comma-separated process/page accesses such as p0,q1; no stdin. Regex parses lowercase process prefix and decimal page number.
- Options: `--npvbits <num>` INTEGER **2**; `--npfbits <num>` INTEGER **2**; `-x/--save <prefix>`; `--wsbits <num>` INTEGER **1**; `--processes <list>` LIST with no default; `--upto <num>` INTEGER **-1**; C.
- No CLI policy option. Despite produceConfig initially labeling FIFO, generateArtifacts computes **both LRU and FIFO**. --processes is not parser-required and is not inferred from accesses; do not add an inferred default.
- stdout compact `{latex}` (fault counts are omitted from CLI output). Save suffixes `lru`, `fifo`, `lru-blank`, `fifo-blank`, `configurazione`. upto governs hiding later blank rows. R.

### memmap generate [csvfile]
Evidence: `bin/vz-memmap.js:12-45`.
- Optional CSV file; omitted => stdin. Option `-t/--latex` only.
- Engine bin/lib/generate_mem_diagram.py -i temporary input.
- stdout raw generated LaTeX with -t, otherwise compact `{latex:[...]}` with artifact name memory diagram, sfx `memory-diagram`, class article, engine pdflatex, memmap preamble include. No direct output-file/save options. D.

### memmap preamble
No args/options/stdin; stdout memmap.tex preamble, no output files; D. `bin/vz-memmap.js:47-53`.

### fsm [json] [yaml] (ordinary synthesis mode)
Evidence: `bin/vz-fsm.js:12-49`; `bin/lib/fsm.js:189-190,344-378,434-516`.
- Optional JSON file; omitted => stdin, except example/collection mode. Second positional only for exercises.
- Options: `-o/--output <markdown>`; `--manifest <yaml>`; `-s/--save <string>`; `-r/--random-seed <value>` INTEGER **1**; `-e/--example <string>`; `-w/--draw`; C.
- Native FSM synthesis generates diagram, transition and output tables, D/JK/SR/T excitation table families, expressions/Karnaugh maps, and state encoding. Diagram and state-encoding artifacts specify lualatex; other table/expression artifacts pdflatex. --draw really restricts artifacts to the diagram, unlike sched --draw.
- No save: draw prints only diagram LaTeX; otherwise compact `{latex}`. Save follows C. Families use `diagram`, `state-encoding`, `transition-table[-blank|-short-blank]`, `output-table[...]`, `d/jk/sr/t-excitation-table[...]`, plus kebab-cased per-signal expression/karnaugh-map names. Names/order depend on input widths; preserve exact generator output rather than renaming suffixes.
- --example dumps a file from bin/lib/fixtures/<example>.json, without validating the advertised moore/mealy choices. That directory is absent in the inspected tree; matching examples exist under bin/fixtures/fsm/src. This is a current source-level broken-path hazard, not a requested repair.
- Non-exercises yaml/output/manifest rejects as in sched. S for immediate dispatch failures; R for the returned JSON read/synthesis/save chain; example read Promise is D.

### quine <table>
Evidence: `bin/vz-quine.js:12-31`; `bin/lib/quine.js:126-135,351-436`.
- Required inline truth-table string; no stdin/file input despite unused file/stdin imports.
- Options: `-s/--save <prefix>`; `-x/--var <prefix>` STRING **x**; `-r/--vars <string>` comma-separated explicit variable names, overrides -x; C.
- Default variable count ceil(log2(argument.length)); generated variable names x_0,x_1,... . Engine skips `/`, maps x or - to don't-care, 1 to on, other characters to off. Four-variable Karnaugh maps only; other sizes emit the generator's explanatory text.
- stdout full pretty synthesis result including implicants/charts/quicksynth/quicksynthk/funcname/latex. Save suffixes `implicants-tables`, `sop-form`, `implicant-charts-complete`, `solution-detailed`, `solution-expression`, `karnaugh-maps`, plus `implicant-chart-<iteration>`.
- S during synthesize; R for returned save/compile Promise.

### wave [file]
Evidence: `bin/vz-wave.js:20-61,65-145,149-236`.
- Optional WaveDrom text/VCD file; omitted => stdin.
- Options: `--end <integer>` INTEGER **10**; `-s/--signals <string>`; `-a/--save <prefix>`; `--is-vcd`; `-p/--posedge-clock` (otherwise negedge clock encoding); `-n/--trim-names`; `--show-sigs`; `-w/--white-list <names>` LIST; `-z/--dump-tikz`; `-d/--dump-classic-pdf <file>`; `-j/--dump-json`; `-r/--regformat`; `-b/--bits <num>` INT **32**; C.
- Ordinary mode precedence: dump-json first; else dump-classic-pdf; else generate both complete/whitelisted TikZ; if save => C write; otherwise dump-tikz => raw complete TikZ, else pretty `{latex}`. Save suffixes `wave`, `wave-whitelisted`.
- VCD mode parses and samples signals to end; optional signals order/filter; trim-names uppercases and removes hierarchy. show-sigs prints the signal-name array to stdout before subsequent output.
- Classic wave path uses wavedrom-cli -> CairoSVG, register mode uses bitfield -> svg2pdf. regformat requires -d and ignores ordinary JSON/TikZ/save routing.
- IMPORTANT: whitelist transformation reads options.whiteList, but dump-json tests options.whitelist (lowercase l). Thus --white-list produces masked saved artifacts, but the JSON branch prints the original wavedrom rather than whitelisted text. Preserve current stream contract; do not fix while aliasing.
- Error paths: awaited read/parse/TikZ generation failures use W=1; classic-PDF Promise returned from the async action uses R for its rejection; artifact writes are not awaited/returned (D); register path starts an unreturned .then chain (D).

### sootty mask <source> <target> <signals>
Evidence: `bin/vz-sootty.js:9-20`; `bin/lib/sootty-mask.js:15-96`.
- Required source SVG path, target path, comma-separated exact signal names. No options/stdin.
- Reads/validates sootty SVG, preserves labels and overlays dark mask rectangles across requested signal wave rows, writes target SVG. No stdout on normal success. Trims/deduplicates requested names; rejects empty list, missing signals, or invalid SVG geometry. R.

### rv-fcall diagram [json]
Evidence: `bin/vz-rv-fcall.js:205-219,470-485`.
- Optional JSON file, omitted => stdin.
- Options `-j/--json`, `-b/--blank`.
- Native RISC-V educational layout uses eight-byte words/register slots. -j prints Node's console object inspection `{state,stackAlloc}`, **not JSON.stringify**. Otherwise prints TikZ. The nonblank branch currently calls `console.log(gpdiag(data,state,stackAlloc), true)`: true is a separate console argument, not the renderer's full flag, so output includes the literal true. Blank passes false into gpdiag. Do not normalize this into the artifact renderer during migration. R.

### rv-fcall asm <json>
Evidence: `bin/vz-rv-fcall.js:257-267,269-371,487-506`.
- Required JSON file, no stdin. `--section <s>` STRING default **full**.
- stdout beautified assembly, section prologue/body/epilogue/full. Unknown section strings fall through to full rather than validation failure. Reads functionData.body and cref, replacing `$selfdir` with JSON directory; missing body => empty, missing cref => no source given. No file output. R.

### rv-fcall test <json>
Evidence: `bin/vz-rv-fcall.js:508-553`.
- Required JSON file, no stdin.
- Options: `--cc <format>` STRING default `docker run -v %s:/root/local -w /root/local --rm --entrypoint '/opt/riscv/toolchain/bin/riscv64-unknown-elf-gcc' riscenv-latest %s`; `--run <format>` STRING default `docker run -v %s:/root/local -w /root/local --rm --entrypoint '/usr/local/bin/rv-sim' riscenv-latest %s`; `--log` appends --log-instructions --log-operands to run command.
- Formats substitute volume and compiler/run argument strings. Writes local `<functionData.suffix>-full.s` after $selfdir substitution; expects suffix-test.c and produces suffix-test.exe via compiler. Prints joined stdout/stderr arrays from compile and run on **stdout**, with logger.debug command traces under verbose logging. This uses riscenv-latest/rv-sim, NOT the qemu helper in rv-exec. R.

### rv-fcall artifact [json]
Evidence: `bin/vz-rv-fcall.js:374-467,555-564`.
- Optional JSON argument declared; developCall can read stdin, but action then does path.resolve(args.json), so omitted JSON pathname is not a working end-to-end stdin mode. That failure follows R. Do not accidentally broaden behavior under a new alias without approval.
- Options `-s/--save <string>` + C.
- stdout compact `{latex}` or save. Six suffixes: `complete-diagram`, `blank-diagram`, `asm-source-full`, `asm-source-empty`, `blank-table`, `c-source`. Uses the shared native render function and source reads, not rv-fcall diagram's output quirk. R.

### nomnom [file]
Evidence: `bin/vz-nomnom.js:11-41`.
- Optional file, omitted => stdin; option `-o/--output <filename>` STRING default **output.pdf**.
- nomnoml -> SVG -> CairoSVG PDF file, no normal stdout payload. No keep/open options are registered even though helper reads options.keep/logger. D.

### compile-artifacts [json]
Evidence: `bin/vz-compile-artifacts.js:11-26`; `artifacts.js:46-87`.
- Optional JSON file, omitted => stdin. Expects `.latex` collection.
- `-p/--prefix <string>` STRING default **tmp**; does NOT support C, --save, or font controls.
- Legacy compiler output `<prefix>-all.pdf`, intermediate .tex retained, per-artifact PDFs removed; stdout progress/commands. D (neither outer read chain nor compile Promise is returned).

### gen-assets <yml>
Evidence: `bin/vz-gen-assets.js:10-107`.
- Required YAML manifest file; no stdin.
- `-f/--force`; `-c/--clean`; `-v/--verbose`.
- Resolves question directories relative to YAML's directory; creates question/assets directories; interpolates {qdir} and entry.vars; serializes object inputs by extension; runs shell steps via /bin/bash with **stdio:inherit** (thus child stdin/stdout/stderr pass through). Executed commands retain caller cwd unless the step itself cd's.
- Default cache is SHA256 of entry JSON in question/.assets-stamp; unchanged => cached unless force. Manual entries skipped. Prints `[qdir] built|cached|skip` on stderr; verbose prints each command to stderr; stamp written only after successful steps.
- clean wins over force and **recursively deletes the entire question directory**, not just assets/input filenames; manual entries are not deleted though run prints cleaned. entry.cleanup affects actionability but is not executed as a selective cleanup list. S for YAML/I/O/child-process failures.

### rv-exec <prog> <init>
Evidence: `bin/vz-rv-exec.js:10-88`; `bin/lib/rv-native.js:9-78`.
- Required assembly-body and initialization-C paths; no stdin.
- `-v/--verbose`; `-k/--keep`.
- Recognizes uint64_t scalar/constant-size array globals, generates before/after printf harness, wraps assembly with .text/.globl f/.type and trailing ret. Native helper builds/uses Docker **vzpac-rv-exec:latest**, riscv64-linux-gnu-gcc static -O0 + qemu-riscv64-static, per-program default timeout **10s**; this is not rv-fcall test's toolchain.
- Forwards native stdout to stdout and native stderr to stderr. Verbose global names and kept temp directory on stderr. keep retains native build artifacts; otherwise cleaned. Initial Docker image build uses inherited stdio. S; helper throws on build/nonzero/timeout failures rather than returning the native exit code directly.

## 4. All ten collection operations

Common public signature: `<family> exercises <yml> -o/--output <markdown> --manifest <yml>`; no stdin, no CLI defaults. Eight separately registered operations mark both options REQUIRED using option's fifth argument. sched/fsm branches instead inherit optional parent declarations and the shared collection generator validates missing/empty paths.

Common generator: `bin/lib/exercise-collection.js:220-267,350-359,416-418`.
- Reads input YAML with paths such as chapter/template/base_assets relative to that YAML, but CLI output/manifest paths resolved from process cwd.
- Requires tag, chapter, and sections; template mode replaces one family slot; inline mode interpolates namespaced placeholders and allows documented passthrough IDs. Validates IDs, templates/placeholders, output/input collisions and asset-directory overlap before output writes.
- Writes generated Markdown + YAML manifest, creating parent directories and writing only changed content. No normal stdout/status output from the shared collection generator.
- Does not automatically run the generated asset manifest; some family model generation itself executes native verification (below).

| Public operation | Registration/dispatch evidence | Semantic engine and generated asset commands |
|---|---|---|
| sched exercises <yml> | vz-sched.js:15-32; lib/vz-sched/exercises.js:8-27 | Implicit first-positional dispatch. Validates/generates using native scheduler model; manifest materializes schedule JSON and emits `vzpac sched {input} -c -s {prefix}`. R, including synchronous generator failures because parent action is async. |
| fsm exercises <yml> | vz-fsm.js:14-39; lib/vz-fsm/exercises.js:7-39 | Implicit first-positional dispatch. Native FSM model/synthesis; emits `vzpac fsm {qdir}/fsm.json[ -w][ -r seed] -c -s ...`; prose kinds manual. S for synchronous model/collection errors. |
| pipe exercises <yml> | lib/vz-pipe/exercises.js:8-39 | Same native pipeline model/library; emits `vzpac pipe pipesim {program} [all selected fw/branch/geometry/conflict flags] -c -s {prefix}`. S. |
| cache exercises <yml> | lib/vz-cache/exercises.js:24-82 | **Uses cache-new simulation generator, NOT legacy cache sim**. Seed defaults to exercise ID. Maps array accesses to --trace, JSON initial to --initial, preserves hit/conflict/config options; emits `vzpac cache-new sim ... -c -x {prefix}`. S. |
| mmu exercises <yml> | lib/vz-mmu/exercises.js:8-50 | Validates collection geometry/accesses and computes both FIFO/LRU fault counts. Emits mmu sim with all processes/page sizes/upto plus -c -x. Collection schema policy is not a native CLI policy selector. S. |
| memory exercises <yml> | lib/vz-memory/exercises.js:7-39 | kind=cache delegates to cache exercise/new simulation path; other kinds build register WaveDrom and emit `vzpac wave ... -r -d ...pdf`. S. |
| logic exercises <yml> | lib/vz-logic/exercises.js:7-49 | Boolean model; minimization emits quine with explicit vars and -c -s; netlists materialize Verilog and emit `vzpac netlist ... --<mode> -o ...pdf`; prose/manual supported by family model. S. |
| seq exercises <yml> | lib/vz-seq/exercises.js:8-60 | Native RTL/testbench generation; emitted iverilog/vvp steps then either vzpac wave TikZ compilation or external sootty + `vzpac sootty mask` + CairoSVG, plus vzpac netlist. Prose/manual branch exists. S. |
| isa exercises <yml> | lib/vz-isa/exercises.js:7-31; model.js:142-187 | Program cases **execute native reference and assembly verification during collection generation** via rv-native; fragment kinds explicitly nonexecutable. Outputs evidence/source entries in manifest marked manual, plus Markdown. gen-assets skips manual entries even if they contain inputs. S. |
| rv-fcall exercises <yml> | lib/vz-rv-fcall/exercises.js:8-51; model.js:31-47 | **Executes native cases during generation**, shares ISA verification and RISC-V layout renderer. Manifest inputs include layout/body/C/full/prologue/epilogue/empty/evidence/test sources; emitted artifact step `vzpac rv-fcall artifact ... -c -s .../rv-fun`. S. |

Implicit dispatch details that must survive alias planning:
- Literal first positional `exercises` wins before ordinary file reading and FSM --example handling. A file literally named exercises collides with this reserved selector; there is no distinct registered nested command to dispatch instead.
- Missing second positional gives exact parent error `sched exercises requires a YAML file` / `fsm exercises requires a YAML file`.
- Shared parent save/draw/num/example/compile/font options are accepted but ignored in the collection branch.
- Comments attributing this parent-first matching to Caporal 1 are stale. Both declared AND installed Caporal are **0.8.0** (`package.json:10`, `node_modules/caporal/package.json:3`). The actual installed parser really does stop on the first registered prefix match (`lib/program.js:107-117`).

## 5. Standalone vz-pipe-new and engine boundaries

`bin/vz-pipe-new.js:5-59` imports **the same** `./lib/vz-pipe/lib` runAndSave, registers the same exercise builder, sets SUBNAME=`pipe`, and has the same pipesim/preamble options/actions as vz-pipe. Its package-exported invocations are:
- `vz-pipe-new pipesim <program> [pipe pipesim options]`
- `vz-pipe-new preamble`
- `vz-pipe-new exercises <yml> -o ... --manifest ...`

It is absent from vzpac's module array; do not invent an existing `vzpac pipe-new ...` contract. In the inspected source there is no second pipeline timing engine selected by this executable. Separate preservation of the standalone binary name is required even though its engine and command registration are shared. Explicit-source comparison is static, not an executed equivalence test.

Actual engine separations worth representing in a canonical plan:
1. Legacy cache inline simulator vs new seeded cache config/sim generator (different arguments, associativity units, defaults, output schemas and suffix sets).
2. Pipe timing simulator vs its exercise model (same underlying native timing library, additional collection computations).
3. Artifact C compiler (xelatex/lualatex+pdfcrop per file) vs compile-artifacts/view legacy tikz2pdf+pdftk aggregate compiler.
4. rv-fcall educational eight-byte rendering and rv-sim Docker testing vs rv-exec/ISA qemu native execution.
5. Legacy direct MIPS/SPIM vz-fcall versus RISC-V rv-fcall.
6. Wave TikZ/native artifacts vs classic WaveDrom PDF vs bitfield register PDF vs external sootty sequence pipeline.

## 6. Other direct-script-only CLIs

Not part of vzpac or package bin; do not add them silently just because names resemble registered domains.

### node bin/vz-fcall.js ... — MIPS/SPIM, four-byte words
Evidence: `vz-fcall.js:14-34,211-255,345-441`; `lib/spim.js:27-61`.
- `diagram [json]`: file or stdin; `-j/--json` prints inspected `{state,stackAlloc}`, not strict JSON; `-b/--blank` changes TikZ. R.
- `asm <json>`: required file; no options; stdout beautified MIPS assembly, $selfdir source resolution. R.
- `test <json>`: required file; no options; builds per-test main and runs SPIM; compares returned v0 and prints colored OK/KO messages. A mismatched expected value only prints KO; no explicit failure exit code. SPIMEXFILE env optionally changes SPIM exception file. R for execution failures.
- `artifact [json]`: optional file declared, stdin read supported initially but same later path.resolve(args.json) incompatibility; `-s/--save <string>`, **no C**. stdout compact `{latex}` with complete-diagram, blank-diagram, asm-source, c-source. Save branch currently passes the whole `{latex}` object to saveArtifacts rather than result.latex: [INFERENCE] malformed artifact descriptors, not a reliable successful .tex output contract. Flag as existing behavior/problem, not an alias repair. R.

### node bin/vz-src.js ...
Evidence: `vz-src.js:12-67,69-94`.
- `decorate [file]`: file or stdin; `-l/--language <string>` STRING **c**; `-p/--prefix <string>` STRING **ml**; `-s/--pos <string>` STRING **left** (only exact left takes left branch, every other string goes right); `-t/--latex`. Emits JSON artifact `{latex}` with suffix code or raw minted/TikZ LaTeX with -t. No writes. D.
- `annotate <string>`: required inline specification, no options/stdin. Splits annotation groups by `/`, node list and text by commas; emits overlay TikZ. Existing renderer text/geometry quirks remain source behavior. S.

### node bin/view.js [file]
Evidence: `view.js:14-46`.
- Default command, optional artifact JSON file or stdin.
- `-k/--keep`; `-e/--expression <expr>` filters artifact names by regex match.
- Uses legacy compiler in temporary directory, moves aggregate to cwd **artifact-all.pdf**, opens it with desktop handler, invokes temp cleanup. Logs compiler commands to stdout. keep changes tmp.dir unsafeCleanup option; action still invokes cleanup. D.

## 7. Option collisions, parser behavior, and migration traps

### Cross-command short-option collisions (must remain command-local)

| Option | Existing meanings |
|---|---|
| -s | save: sched/fsm/pipe/quine/rv-fcall artifact; cache-size bits: both cache families' config/legacy sim; signal selection: wave; annotation position: vz-src |
| -x | save: cache/cache-new/mmu; variable prefix: quine; flip-flop indices: netlist |
| -a | save: wave only |
| -o | PDF output: netlist/nomnom; Markdown output: all collections/parent sched/fsm; boolean no-instructions: pipe |
| -p | open PDF: netlist; prefix: compile-artifacts/vz-src; posedge clock: wave |
| -w | watch: netlist; draw: sched/fsm; log2 ways: cache; actual ways: cache-new; whitelist: wave |
| -n | schedule number(default 9): sched; max cycles: pipe; accesses(default 6): cache-new sim; trim names: wave |
| -b | log2 block size: cache/new; blank: pipe/rv-fcall diagram/MIPS diagram; bit count(default 32): wave |
| -d | dont-simulate: cache; debug: pipe; classic PDF filename: wave |
| -r | random seed(default 1): fsm; explicit variables: quine; register mode: wave |
| -e | example: fsm; initial cache triplets: cache; regex: direct view |
| -j | trace JSON: cache; output WaveDrom: wave; inspected JS object: rv-fcall/MIPS diagram |
| -c | compile artifact set C; **recursive clean**: gen-assets |
| -f | forwarding: pipe; force rebuild: gen-assets |
| -v | Caporal global verbosity; also explicitly declared application verbosity in gen-assets/rv-exec |
| -k | retain temp data: netlist/rv-exec/view, with different lifecycles |
| -t | raw LaTeX: memmap/vz-src |

Long-name collisions: `--conflicts` is annotation string in pipe but integer replacement-miss lower bound in cache-new; `--ways` is actual count versus legacy `--cacheways` exponent; `--output` is rendered PDF versus collection Markdown; `--json` is strict trace JSON versus inspected JS object; `--draw` has effective FSM behavior but currently ineffective scheduler behavior. No one shared global option schema can safely normalize these.

### Native parser flags/commands
Evidence: installed Caporal `lib/command.js:459-460`, `lib/program.js:100-164,236-248`, help.js:130-135.
- Every CLI parser recognizes `-h/--help`, `-V/--version`, `--color` (including --no-color handling as passed by its tokenizer), `--quiet`, `--silent`, `-v/--verbose` as native names. Version explicitly configured to 0.0.1 only in vzpac.
- `help [command words...]` prints help and explicitly exits 0.
- Missing or unknown command also prints help and explicitly exits 0, rather than an unknown-command failure. Parent-first command matching affects future nested canonical registrations.
- `completion <bash|zsh|fish>` emits the tabtab completion script through logger.info; invalid/missing shell exits 2; `completion --` enters autocomplete listener. This built-in is not a registration module.
- Native quiet/silent/verbose controls logger filtering before command validation. Ordinary native flags are not passed to action option objects unless that command explicitly declares them; gen-assets and rv-exec do declare verbose.

### Tokenization and option-resolution traps
Evidence: `node_modules/micromist/src/micromist.js:3-35,48-88`; Caporal command.js:147-150,264-359.
- Parsing is schema-blind: an option without `=` consumes the following non-option token even when the registration describes a boolean switch. Moving boolean flags before positional arguments can therefore change argument routing; do not canonicalize by naively rebuilding/reordering argv.
- Repeated options become arrays; typed validators and downstream code may then behave differently. An explicit long option wins when both its short/long forms are supplied because camel-casing chooses defined long value.
- The tokenizer preserves `--` in the positional tail; do not assume standard end-of-options stripping semantics when writing a replacement parser.
- `--no-instructions` remains the literal long name in this tokenizer; it is not automatically a negated `--instructions` option.
- Numeric conversion is opt-in through Caporal validators or downstream normalizers; do not introduce uniform coercion. In particular pipe max-cycles has no Caporal validator and hrowsep uses undefined prog.DOUBLE, then downstream normalization; C's font default has no explicit validator.

## 8. Affected callsites for the eventual approved mapping

Every family exercises.js embeds legacy `vzpac ...` steps. They are the primary internal callers to migrate under clean cutover: sched, fsm, pipe, cache-new via cache/memory, mmu, wave, sootty mask, netlist, quine, rv-fcall artifact. External invocations in generated manifests and package standalone executable names remain separate compatibility surfaces. Source line references are in §4; `lib/vz-seq/exercises.js:18-36` is particularly dense (external iverilog/vvp/sootty/CairoSVG plus internal wave/mask/netlist).

No canonical naming decision, implementation, runtime-help result, or alias equivalence is claimed here. This is a planning inventory only. The parent proposal must obtain user approval of the complete mapping and the required explicit opus/fable review before treating the overall naming task as closed.