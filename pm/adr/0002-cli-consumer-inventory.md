## Scope and evidence policy
All findings below come from static reads/searches only. No CLI invocation, execution, build, test, formatter, package-manager or git command was run. Acceptance scenarios are proposed future checks, not observed results. Paths are relative to materiale-corsi; sibling paths start ../netlistsvg. This is a caller-to-owner migration map; final domain/object/verb spellings belong to the parent proposal and require explicit approval, not inference from these findings.

## 1. Current canonical course callers — materiale-corsi ownership

### 1A. Haskell and edition entrypoints are indirect callers
- `pac/courses/2026-2027/makefile:1-4,18-19`: edition consumes `../common`; the `exercises` target delegates to `../common/assets`. Other edition targets use mcbuild.
- `sbuild/Shakefile.hs:34-37`: both PAC25 and PAC26 remain configured; historical does not mean unreachable.
- `sbuild/PAC26.hs:3-5,45-117`: canonical notes/assets/exercise YAML, generated chapter paths and generated manifests are defined here. `:185-188` runs `make -C <assetsDir> exercises`; `:190-195` runs `make -C <assetsDir> all`. There is no direct operational `vzpac` command string in the Haskell modules examined; `:193` is a comment.
- Ownership: migrate executable spellings in the assets makefile, not by adding a second command-dispatch convention in Haskell. Preserve Haskell dependency order: MMU→cache, MMU→sched examples, FSM→seq, fcall→ISA. Source evidence also appears in `common/exercises/cache.yml:1-3`, `sched-examples.yml:1-2`, `seq.yml:1-4`, `seq-examples.yml:1-4`, and `isa-functions.yml:1-2` / `isa-function-examples.yml:1-2`.
- Root `makefile:20-24` and `ci.sh:7-35` only delegate into course build/delivery scripts; they contain no command spelling to rename for this migration.

### 1B. Canonical collection recipe map
All paths in this table refer to `pac/courses/common/assets/makefile`. Each primary recipe has a real missing-output fallback that must migrate too. All currently use `-o "..." --manifest "..."` with quoted paths.

| Current command family | Primary/fallback lines | Canonical YAML under common/exercises |
|---|---|---|
| `vzpac mmu exercises` | 133/137; 140/144 | mmu.yml; mmu-examples.yml |
| `vzpac pipe exercises` | 147/151; 154/158 | pipe.yml; pipe-examples.yml |
| `vzpac sched exercises` | 161/165; 168/172 | sched.yml; sched-examples.yml |
| `vzpac cache exercises` | 175/179 | cache.yml |
| `vzpac memory exercises` | 182/186 | memory.yml |
| `vzpac logic exercises` | 189/193; 196/200 | logic.yml; logic-examples.yml |
| `vzpac fsm exercises` | 203/207; 210/214 | fsm.yml; fsm-examples.yml |
| `vzpac seq exercises` | 217/221; 224/228 | seq.yml; seq-examples.yml |
| `vzpac rv-fcall exercises` | 231/235; 238/242 | fcall.yml; fcall-examples.yml |
| `vzpac isa exercises` | 245/249; 252/256; 259/263; 266/270; 273/277 | isa-block.yml; isa-functions.yml; isa-intro-examples.yml; isa-block-examples.yml; isa-function-examples.yml |

The same makefile runs `vzpac gen-assets $<` at `:289,293,297,302` (MMU examples, pipeline examples, CFS examples and generic chapter manifests). Preserve `.NOTPARALLEL`, Bash and `VZPAC_JOBS ?= 1` at `:12-15`; changing naming must not alter concurrency/compilation semantics. `$<` in these four existing recipes is unquoted, unlike the collection paths: do not claim full existing workspace-path-with-spaces support from the quoted collection recipes alone.

### 1C. Five maintained figure manifests, not disposable generator output
These are the canonical files to migrate directly. Header text saying “Generated figures” or naming a converter describes origin, not current ownership.

| Canonical path under common/assets | Command spellings and exact lines |
|---|---|
| `1_rl_seq/base-assets.yml` | `vzpac wave`: 17,33,52,64,80,96,112,124,139,152,165,180,198,210,226,238,254,272 |
| `3_arch_mem/base-assets.yml` | `vzpac wave ... -r -d ...`: 10,21 |
| `2_isa_intro/assets.yml` | `vzpac wave ... -r -d ...`: 20,38,51,65,83,96,114,128,147,166,177 |
| `3_arch_pipe/assets.yml` | `vzpac wave ... -d ...`: 21,36,51,69,89 |
| `3_arch_os/assets.yml` | `vzpac wave`: 15,29,43,57,75,93,110,126,142,152,162; final register case retains `-r -b 22`; `vzpac nomnom ... -o ...`: 177 |

These steps use `{qdir}/...` without explicitly quoting the placeholder in YAML. The generic asset runner provides a raw absolute qdir unless an adapter overrides it; this is an existing compatibility limitation, not permission to change interpolation during a command rename.

### 1D. Derived outputs: regenerate from owners; do not bulk-edit local matches
`pac/courses/common/.gitignore:1-5,10-57,58` explicitly separates canonical sources from generated per-key directories, manifests and `/generated/`. Generated manifests include:
- cache/MMU in `6_arch_mem_exe/{assets,mmu-assets}.yml`;
- pipeline exercises `6_arch_pipe_exe/assets.yml`, examples `3_arch_pipe/pipe-assets.yml`;
- CFS exercises `6_arch_os_exe/assets.yml`, examples `3_arch_os/sched-assets.yml`; MMU examples `3_arch_os/mmu-assets.yml`;
- memory `3_arch_mem/assets.yml` (NOT `base-assets.yml`);
- logic `1_rl_fc/assets.yml`, `4_rl_fc_exe/assets.yml`;
- FSM/seq `1_rl_seq/{fsm-assets,assets}.yml`, `4_rl_seq_exe/{fsm-assets,assets}.yml`;
- fcall `2_isa_fun/assets.yml`, `5_isa_fun_exe/assets.yml`;
- ISA `isa-assets.yml` in `2_isa_intro`, `2_isa_block`, `2_isa_fun`, `5_isa_block_exe`, `5_isa_fun_exe`.
Their CLI strings are owned by the JS emitters below. The 21 canonical instance YAML files hold structured data/models and relative chapter/base paths, not shell command strings. No live org2md generator was found in pac/scripts, including an ignore-disabled alternate search. `pm/pac/adr/002-pac-notes-markdown.md:151-153` explicitly says the converter was removed and is not part of the current build.

## 2. JS-emitted commands — netlistsvg ownership, cross-repository consequences
Paths below are under `../netlistsvg/bin/lib/`. Rename command prefixes here, then regenerate course manifests. Do not migrate only the course makefile and leave future output emitting legacy syntax.

| Emitter | Current emitted command | Contract to preserve |
|---|---|---|
| `vz-cache/exercises.js:48-68` | `vzpac cache-new sim ... -c -x {prefix}` | Seed defaults to instance ID; quoted seed/JSON `--trace=`/`--initial=`; replay uses `--trace`, not generated counts. This is NOT legacy `cache sim`. |
| `vz-mmu/exercises.js:25-36` | `vzpac mmu sim {alist} --processes={processes} --npvbits ... --npfbits ... --wsbits ... --upto=... -c -x {prefix}` | Quoted comma lists/processes/save path and exact option attachment. |
| `vz-pipe/exercises.js:13-27` | `vzpac pipe pipesim {program} ... -c -s {prefix}` | Shell-quoted program with parentheses; fw/branchopt/branchpred/is-loop/no-instructions, max-cycles, asm-ins, hrowsep, conflicts. |
| `vz-sched/exercises.js:17-21` | `vzpac sched {input} -c -s {prefix}` | Input is a materialized JSON file; input and prefix are individually quoted. |
| `vz-memory/exercises.js:8-11,24-25` | cache delegate OR `vzpac wave {qdir}/wave.json -r -d {qdir}/assets/<name>.pdf` | Cache cases reuse cache emitter; address/register figures use classic register output. |
| `vz-logic/exercises.js:15-24` | `vzpac quine <table> -r <variables> -c -s ...`; `cd {qdir} && vzpac netlist netlist.v --<mode> -o assets/<name>.pdf` | Ordered variables/table, `simple`/`aig` mode and per-job cwd remain unchanged. |
| `vz-seq/exercises.js:19-36,41-44` | wave `-n --is-vcd ... --end ... -w ... -c -a ...`; `vzpac sootty mask ...`; `vzpac netlist ...` | Preserve Icarus/vvp steps, renderer choice, redirecting external sootty, cairosvg, optional ff-indices/skin and techmap script. Do NOT rename external `sootty` into `vzpac sootty mask`. |
| `vz-fsm/exercises.js:31-32` | `vzpac fsm {qdir}/fsm.json<draw><seed> -c -s ...` | Same native engine, draw-only behavior, seed and artifact suffix set. |
| `vz-rv-fcall/exercises.js:12-16,34-36` | `vzpac rv-fcall artifact {qdir}/input.json -c -s {qdir}/assets/rv-fun` | JSON layout contains `$selfdir/body.s` and `$selfdir/source.c`; keep generated sibling files and source-relative lookup. |
| `vz-isa/exercises.js:7-19` | NO shell step: `{manual: true, inputs}` | Verification executes during collection generation; do not invent a deferred `rv-exec` command. Sources/evidence are serialized into the manifest. |

`exercise-collection.js:39-44,46-58` owns relative-input and physical-directory resolution and shellQuote; `:414-418` serializes/writes derived output. Quoted qdir values deliberately concatenate with `/file` after a closing shell quote; a rewrite must not double-quote or dequote them.

## 3. Exam SSOTs and retained standalone consumers

### 3A. Latest examined exam: migrate canonical source directly
`pac/exam-sheets/20260910/makefile:12,25`: `vzpac gen-assets` build and `--clean`.
`pac/exam-sheets/20260910/assets.yml`:
- `:16`: quine with options before positional truth table.
- `:108`: netlist with `-v -k -x 0,1,2 --script "prep -auto-top; techmap; opt;"`.
- `:110`: sootty SVG mask; external `sootty` at `:109` remains external.
- `:248`: rv-fcall artifact, compiled prefix `assets/rv-fun`.
- `:249-251`: rv-fcall asm full/prologue/body redirected to named `.s` files; no new stdout banner is permissible.
- `:273`: pipe pipesim with quoted repeated instruction expression, `--fw --asm-ins 4 --is-loop -n 28 -c -s ...`.
- `:277`: cache-new sim, deterministic seed 20260910 and specific memory/ways/hits flags.
- `:313`: sched with JSON positional filename.

### 3B. Retained exams: real compatibility consumers, not generated duplicates
`20260724`, `20260723` and `20260629` assets.yml files are SSOTs for their own exams, not disposable historical build output. They have legacy spellings and streams:
- `20260724/assets.yml:16,105,245-248,270,274,317`: vz-quine; vz-netlist; vz-rv-fcall artifact/asm; vz-pipe-new pipesim; vzpac cache-new sim; `cat ... | vz-sched`.
- `20260723/assets.yml:16,105,245-248,270,274,317`: same command families, different exam data/seed.
- `20260629/assets.yml:16,105,238-241,269,273,309`: same families with its own data/options.
- Each exam makefile calls `vzpac gen-assets` at `:12,25`.
Ownership choice: migrate retained exam source command strings only if the approved caller scope includes those exams; otherwise preserve them as permanent alias acceptance fixtures. Never classify their assets.yml files as generated merely because they produce assets.

### 3C. Historical/archival consumers — representative evidence only
- `pac/courses/2025-2026/notes/doc_notes.org:2898,12536,12575`: heredoc/stdin `netlistsvg` with `--simple`/`--aig`; `:10307,10437,10453,10468`: literal installed name `vz-cache.js sim`, explicit binary traces and geometry. ADR-002 `:151-153` requires this Org source to remain immutable for the new edition; do not do a repository-wide textual replacement.
- PAC25 remains callable through `sbuild/Shakefile.hs:34`; `sbuild/PACCommon.hs:52-55,91-104` still routes archived-edition notes through org2handout/org2pdf. Whether those external renderers execute Babel was not determined statically; do not claim this path was exercised.
- `pac/courses/2025-2026/notes/assets/arch/pipe/makefile:3`: `cat $< | vz-wave -d $@`.
- `pac/courses/2025-2026/notes/assets/isa/riscv-fcall/makefile:6,9,19,23,27`: artifacts saved as .tex; JSON artifact stream piped into an absolute old checkout's `bin/view.js`; assembly redirection; native `test` and `test --log`. Repeated exercise subdirectories follow this same convention; do not enumerate/edit each copy for the current canonical cutover.
- `pac/courses/2024-2025/notes/assets/reti/sc_syn/gen/exe6/makefile:14,17,20,23,27,30`: wave JSON stdout→file→vz-compile-artifacts, -all.pdf rename, netlist and direct wave save-prefix behavior. These are historical executable recipes, not current canonical YAML owners.
- `pac/exam-sheets/20260218/q-3.1/makefile:16` and `20260129/q-3.1/makefile:16`: vz-pipe-new, quoted instruction programs, -n/-s and loop flags. Their q-3.3/makefile `:13` consumes JSON on stdin with vz-sched.
- `archive/advanced_topics_fp/docs/notes/preambles/makefile:7,10`: vz-memmap preamble / vz-pipe preamble redirected to TeX.
- `archive/infob/exams/20200616/src/seqex/makefile:16,19`: vz-compile-artifacts and vz-netlist.
No AOS callers of the requested netlistsvg command families were found, including a broader ignore-disabled search of AOS scripts/makefiles/YAML and Haskell. `vz-rubric`, `vz-temi`, `vz-voti`, `vz-registro` etc. are different toolchains, not migration targets.

## 4. Standalone names easy to miss, package scripts and netlistsvg's own consumers

### 4A. Installed executable contract
`../netlistsvg/package.json:43-61` declares exactly these names: vzpac; netlistsvg; vz-netlist; vz-sched; vz-compile-artifacts; vz-wave; vz-quine; vz-pipe; vz-pipe-new; vz-fsm; vz-memmap; vz-nomnom; vz-rv-fcall; **vz-cache.js**; vz-cache-new; vz-mmu; vz-gen-assets; vz-rv-exec.
- `netlistsvg` and `vz-netlist` both point to bin/vz-netlist.js (`:45-46`). Keep both names; the older name is demonstrably consumed via stdin in course sources.
- `vz-cache.js` is the installed name (`:57`); plain vz-cache is not declared. Test batch labels are not evidence of a packaged vz-cache executable.
- `vz-pipe-new` is installed (`:52`) and heavily used by retained exams. Reading `bin/vz-pipe-new.js:1-61` resolves the pipe implementation with SUBNAME pipe and standalone injection at :52-60. Do not infer it is an empty/no-op CLI from directory size metadata.
- `bin/vz-{memory,logic,seq,isa,sootty}.js` are direct runnable standalones but have no package bin entries. Each uses require.main and injects its prefix (memory/logic/seq/isa :7-10; sootty :25-33). Preserve direct `node bin/<name>.js`/executable-file use separately from deciding whether to add installed names.
- `bin/vz-fcall.js:387-441` and `bin/vz-src.js:70-94` are older direct top-level CLIs outside both package bins and vzpac registration. No course caller was found in normal plus ignore-disabled alternate searches. They are not aliases to rv-fcall or generic source rendering: vz-fcall still imports runString from spim (`:8`) and has its own model. Mark them explicitly out of the active mapping or give them a separately reviewed mapping; never silently redirect a different engine.
- Package dependency and lock both declare Caporal **0.8.0** (`package.json:10`, `package-lock.json:13`). “Caporal 1” in pm/readme/state and sched comments is stale documentation, not the dependency version.
- Root lockfile bin metadata (`package-lock.json:42-57`) omits package.json's newer vz-cache-new, vz-gen-assets and vz-rv-exec entries. This is existing metadata drift to consider when package bin declarations are intentionally changed, not evidence that those declared executables do not exist.

### 4B. Real in-repository consumers and stale references
- `bin/test.js:27-44` executes commands constructed by `bin/testbatches.js` using direct executable paths.
- Active exported batches: direct fsm (:4-5), quine (:32-33), rv-fcall (:52-53), pipe (:81-82), wave (:113-114), MMU (:130-131), legacy cache (:143-144), cache-new (:176-177); exported list :197-206. Memmap at :68-77 is defined but not exported: not an exercised harness consumer.
- `bin/testcache.sh:1` directly calls ./vz-cache.js sim. `bin/pipesim-re.sh:6-8` directly calls ./vz-pipe-new.js with older alufw/branchopt forms; do not assert these older flags still succeed from source presence. `bin/rewritefsmtests.sh:1-5` contains old absolute-checkout direct FSM invocations.
- Current consumer tests requiring migration or deliberate alias retention: `bin/lib/vz-pipe/exercises.test.js:65-72`, `vz-sched/exercises.test.js:85-89`, `vz-cache/exercises.test.js:20-24,139-142`, `vz-mmu/exercises.test.js:64-68`, `vz-fsm/exercises.test.js:89-91`, `vz-rv-fcall/exercises.test.js:11-14,52-68`, `bin/lib/sootty-mask.test.js:53-59`. Their substitutions must still execute the emitted canonical command, not accidentally fall back to old names. FSM's exact `replace("vzpac fsm", ...)` is particularly easy to break when changing emitted syntax.
- `package.json:64-66` scripts are lint/test/demo wrappers, not operational shell invocations of vzpac. test:sootty-mask selects the CLI consumer test; build-demo is unrelated. `bin/makefile:1-14` selects legacy/domain/native tests, also not separate command-name callsites.
- Upstream stale references are separate from the current callable contract: README.md:459 says node bin/netlistsvg; test/test-all.js:2 requires ../bin/netlistsvg; test/analog_test.py:186 invokes ../bin/netlistsvg.js; examples/makefile:19 and examples/analog/makefile:8 reference the older upstream paths. examples/makefile.mk:7 even calls `vz-netlist.js netlist <file> ... | ps2pdf`. Inventory these as stale historical references, not a reason to invent an extra positional `netlist` compatibility form. Existing npm-test failure is documented separately in pm/pac/state.md:27; nothing was rerun.

### 4C. Documentation ownership
- netlistsvg README.md:496,512,544-546,635-636,655-657,757-763,856-858 documents actual current collection/native command spellings and generated commands; :656 explicitly promises vz-fsm standalone equivalence.
- netlistsvg pm/readme.md:13-18,31,44-48 documents collection usage, direct file invocation, quoting/link behavior and the distinction between legacy cache sim and cache-new backend.
- materiale-corsi pm/pac/readme.md:9-11,18,25-37 and ADR-002:44-55,128,143-145 describe current execution paths and should adopt the approved canonical command vocabulary.
- ADR-002:21-30 is a historical inventory, not a live command recipe; preserve historical spellings there. ADR-001:80 lists legacy toolchain names and :97 explicitly separates legacy folders.
- `pac/scripts/tests/fixtures/notes/notes.fx_intro.md:141-143` contains a literal shell-code example, not an operational CLI caller; keep its renderer-preservation purpose distinct from command execution acceptance.

## 5. Compatibility risks that constrain the migration
1. **Do not collapse semantic engines.** Legacy cache sim and cache-new sim are distinct. The current collection entrypoint is named cache exercises but emits cache-new sim. New naming must encode that distinction instead of routing old cache invocations to the generator/replay engine.
2. **Preserve streams and omitted positional input.** vz-sched stdin is still used by retained exams; netlistsvg/vz-wave stdin is used by historical recipes. rv-fcall asm stdout is source text redirected into files; artifact JSON stdout feeds view.js or downstream compilers. Silent aliases mean no additional deprecation banner on either stream, not suppressing existing messages.
3. **Preserve flags exactly, including placement.** Exam quine options precede its positional table. -c currently means compile on the artifact commands (`artifacts.js:245-259`), but means clean for gen-assets (`vz-gen-assets.js:103-106`). -r and -x likewise differ by command. A generic global option-normalization layer could change behavior.
4. **Preserve shell syntax, not just argv words.** Programs contain parentheses/commas; netlist scripts contain semicolons; steps use `cd ... && ...`, pipes, heredocs and redirects. gen-assets uses interpolation followed by Bash, not an argv runner (`vz-gen-assets.js:13-15,53,63-66`).
5. **Preserve path bases.** YAML relatives resolve from input YAML; output asset directories resolve from manifest location; steps run in caller cwd unless they explicitly cd. qdir is absolute and adapters sometimes replace it with a shell-quoted value. Function layouts use literal $selfdir. Changing to unconditional per-question cwd or centralized quoting is extra scope and can break callers.
6. **Distinguish existing limitations from new regressions.** Adapter-emitted paths support apostrophes/metacharacters through shellQuote and existing targeted tests; static manifests have raw qdir, gen-assets recipes have unquoted $<, and artifact internals also use shell strings. Do not promise repository-wide whitespace-safe paths without separate proof; preserve the already supported adapter cases without bundling unrelated path fixes.
7. **Files/stamps are API.** Shared writeArtifacts selects .tex unless --compile, then per-suffix .pdf (`artifacts.js:232-241`); legacy compile-artifacts merges to <prefix>-all.pdf (`:79-85`). gen-assets hashes the full entry, runs sequential steps, writes .assets-stamp only after success, logs status to stderr and removes the per-entry directory on --clean (`vz-gen-assets.js:35-38,44-69,73-96`). A command-string rename changes hashes and should rebuild affected entries naturally.
8. **Routing must be proved against the actual framework.** sched and FSM have parent handlers with a positional `exercises` branch, not just nested registrations. Preserve old file/stdin dispatch and collection dispatch while adding canonical routes; do not derive parser behavior from the stale major-version comments.

## 6. Bounded acceptance scenarios for the implementation phase
These are proposed finite scenarios, not run here. Use paired legacy/canonical invocations with identical inputs/options and compare engine-visible data, streams, exit status and file sets; exempt only the intended help presentation.

A. **Installed/direct alias surface:** cover every package bin key from package.json:44-61 and the five non-package direct wrappers. At minimum include netlistsvg, vz-cache.js, vz-pipe-new, and direct FSM exercises. Check no new alias notices on stdout/stderr. Keep legacy src/fcall explicitly outside scope unless separately approved.
B. **Engine separation:** one explicit binary-trace legacy cache sim fixture from bin/testbatches.js:147-169, one seeded cache-new sim fixture :185-193, and one cache exercises instance. Confirm canonical names route to the same respective engines, not merely parse successfully.
C. **Collection-to-emitted-command chain:** one instance per emitter family in section 2; inspect and actually execute its emitted canonical command. Include memory kind:cache to demonstrate delegation, logic minimize plus netlist, seq wave plus sootty-mask variant, FSM draw-only/full, and fcall→ISA composition. ISA must still verify at generation, not deferred asset build.
D. **Supported path safety:** rerun the already modeled moved-manifest/apostrophe/metacharacter adapter scenarios in cache/MMU/pipe/sched/FSM/seq tests; compare destinations and absence of unintended shell side effects. Do not label the static-manifest full workspace path case passing without a separate baseline.
E. **Current make ownership:** invoke the 21 collection recipe paths, including at least one missing-output fallback, then representative gen-assets entry paths. Preserve dependency ordering and VZPAC_JOBS=1. No hand-edited derived manifests are acceptable as proof.
F. **One current exam:** use 20260910's SSOT to cover quine's option placement, netlist techmap script, mask output, four rv-fcall paths, loop pipeline, seeded cache and JSON-file CFS. Compare expected artifact basenames and assembly file content.
G. **One retained standalone exam:** use 20260724, 20260723 or 20260629 to cover vz-pipe-new, vz-rv-fcall, vz-netlist, vz-quine and piped vz-sched. Permanent aliases must remain sufficient if archive sources intentionally stay unchanged.
H. **Streaming equivalence:** compare scheduler JSON file versus piped stdin; waveform file versus stdin; rv-fcall asm full/prologue/body redirected to files; legacy wave JSON→compile-artifacts prefix-all.pdf. Any existing extra stdout must remain as-is rather than be 'cleaned up' during renaming.
I. **Build/cache/clean/failure:** build a tiny real manifest once, rerun unchanged to see cached status, change one step to see only that entry rebuild, then clean. A failing real command must fail nonzero and not stamp success. Preserve status streams; do not use no-op mocked commands as end-to-end proof.
J. **Dispatch/options boundaries:** old sched/FSM file input, omitted input with stdin, old exercises form and each approved canonical form; invalid command/option and malformed input; preserve legacy exit behavior and no generated files on generation validation failure. Include -c compile versus gen-assets -c clean and default .tex versus compiled .pdf.

## 7. Migration ownership / closure handoff
- netlistsvg: approved routes and legacy routes/standalones; emitters; affected command-consuming tests; package metadata; README/pm command documentation.
- materiale-corsi: canonical assets makefile and five maintained manifests; approved-scope exam SSOTs; current build documentation. Regenerate ignored YAML/Markdown rather than editing outputs. Leave archived Org and historical explanatory inventory unchanged unless separately approved.
- Parent proposal must reconcile this map with its runtime-help inventory and explicitly state retained historical callers. `../netlistsvg/pm/state.md:10` requires the user's approval of the complete mapping AND an explicit opus/fable review/OK before bead closure. This read-only inventory is evidence for that gate, not satisfaction of either approval or runtime verification.