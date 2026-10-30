[![Build Status](https://travis-ci.org/nturley/netlistsvg.svg?branch=master)](https://travis-ci.org/nturley/netlistsvg)
[![Gitter chat](https://badges.gitter.im/nturley/netlistsvg.png)](https://gitter.im/netlistsvg)
# netlistsvg
draws an SVG schematic from a [yosys](https://github.com/cliffordwolf/yosys) JSON netlist. It uses [elkjs](https://github.com/OpenKieler/elkjs) for layout.

You can see an online demo [here](https://nturley.github.io/netlistsvg)

<details>
  <summary>JSON Source</summary>

```json
{
  "modules": {
    "up3down5": {
      "ports": {
        "clock": {
          "direction": "input",
          "bits": [ 2 ]
        },
        "data_in": {
          "direction": "input",
          "bits": [ 3, 4, 5, 6, 7, 8, 9, 10, 11 ]
        },
        "up": {
          "direction": "input",
          "bits": [ 12 ]
        },
        "down": {
          "direction": "input",
          "bits": [ 13 ]
        },
        "carry_out": {
          "direction": "output",
          "bits": [ 14 ]
        },
        "borrow_out": {
          "direction": "output",
          "bits": [ 15 ]
        },
        "count_out": {
          "direction": "output",
          "bits": [ 16, 17, 18, 19, 20, 21, 22, 23, 24 ]
        },
        "parity_out": {
          "direction": "output",
          "bits": [ 25 ]
        }
      },
      "cells": {
        "$add$input.v:17$3": {
          "type": "$add",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 16, 17, 18, 19, 20, 21, 22, 23, 24 ],
            "B": [ "1", "1" ],
            "Y": [ 26, 27, 28, 29, 30, 31, 32, 33, 34, 35 ]
          }
        },
        "$and$input.v:28$5": {
          "type": "$and",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 12 ],
            "B": [ 35 ],
            "Y": [ 36 ]
          }
        },
        "$and$input.v:29$6": {
          "type": "$and",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 13 ],
            "B": [ 37 ],
            "Y": [ 38 ]
          }
        },
        "$procdff$40": {
          "type": "$dff",
          "port_directions": {
            "CLK": "input",
            "D": "input",
            "Q": "output"
          },
          "connections": {
            "CLK": [ 2 ],
            "D": [ 39, 40, 41, 42, 43, 44, 45, 46, 47 ],
            "Q": [ 16, 17, 18, 19, 20, 21, 22, 23, 24 ]
          }
        },
        "$procdff$41": {
          "type": "$dff",
          "port_directions": {
            "CLK": "input",
            "D": "input",
            "Q": "output"
          },
          "connections": {
            "CLK": [ 2 ],
            "D": [ 36 ],
            "Q": [ 14 ]
          }
        },
        "$procdff$42": {
          "type": "$dff",
          "port_directions": {
            "CLK": "input",
            "D": "input",
            "Q": "output"
          },
          "connections": {
            "CLK": [ 2 ],
            "D": [ 38 ],
            "Q": [ 15 ]
          }
        },
        "$procdff$43": {
          "type": "$dff",
          "port_directions": {
            "CLK": "input",
            "D": "input",
            "Q": "output"
          },
          "connections": {
            "CLK": [ 2 ],
            "D": [ 48 ],
            "Q": [ 25 ]
          }
        },
        "$procmux$36": {
          "type": "$pmux",
          "port_directions": {
            "A": "input",
            "B": "input",
            "S": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 16, 17, 18, 19, 20, 21, 22, 23, 24 ],
            "B": [ 26, 27, 28, 29, 30, 31, 32, 33, 34, 49, 50, 51, 52, 53, 54, 55, 56, 57, 3, 4, 5, 6, 7, 8, 9, 10, 11 ],
            "S": [ 58, 59, 60 ],
            "Y": [ 39, 40, 41, 42, 43, 44, 45, 46, 47 ]
          }
        },
        "$procmux$37_CMP0": {
          "type": "$eq",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 13, 12 ],
            "B": [ "0", "1" ],
            "Y": [ 58 ]
          }
        },
        "$procmux$38_CMP0": {
          "type": "$eq",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 13, 12 ],
            "B": [ "1", "0" ],
            "Y": [ 59 ]
          }
        },
        "$procmux$39_CMP0": {
          "type": "$eq",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 13, 12 ],
            "B": [ "0", "0" ],
            "Y": [ 60 ]
          }
        },
        "$reduce_xor$input.v:27$4": {
          "type": "$reduce_xor",
          "port_directions": {
            "A": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 39, 40, 41, 42, 43, 44, 45, 46, 47 ],
            "Y": [ 48 ]
          }
        },
        "$sub$input.v:16$2": {
          "type": "$sub",
          "port_directions": {
            "A": "input",
            "B": "input",
            "Y": "output"
          },
          "connections": {
            "A": [ 16, 17, 18, 19, 20, 21, 22, 23, 24 ],
            "B": [ "1", "0", "1" ],
            "Y": [ 49, 50, 51, 52, 53, 54, 55, 56, 57, 37 ]
          }
        }
      }
    }
  }
}
```
</details>
<img src="https://cdn.rawgit.com/nturley/netlistsvg/d01285946e05ee5ce99dc5d0f8025be58b5936a3/doc/up3down5.svg" />

The JSON doesn't need to be produced by Yosys, of course. We can process arbitrary block diagrams.

<details>
  <summary>JSON Source</summary>

```json
{
  "modules": {
    "generics": {
      "ports": {
        "clk100": {
          "direction": "input",
          "bits": [ 2 ]
        },
        "clk40": {
          "direction": "output",
          "bits": [ 3 ]
        },
        "clk125": {
          "direction": "output",
          "bits": [ 5 ]
        }
      },
      "cells" : {
        "PLL": {
          "type": "PLL",
          "port_directions": {
            "clkin": "input",
            "clk40": "output",
            "clk200": "output",
            "clk125": "output",
            "locked": "output"
          },
          "connections": {
            "clkin": [ 2 ],
            "clk40": [3],
            "clk200": [6],
            "clk125": [5],
            "locked": [8]
          }
        },
        "MIG": {
          "type": "MIG",
          "port_directions": {
            "clk_ref": "input",
            "clk_sys": "input",
            "reset": "input"
          },
          "connections": {
            "clk_ref": [6],
            "clk_sys": [2],
            "reset": [4]
          }
        },
        "counter": {
          "type": "counter",
          "port_directions": {
            "clk": "input",
            "start": "input",
            "elapsed": "output"
          },
          "connections": {
            "clk": [2],
            "start": [8],
            "elapsed": [4]
          }
        },
        "sync": {
          "type": "sync",
          "port_directions": {
            "clk": "input",
            "in": "input",
            "out": "output"
          },
          "connections": {
            "clk": [3],
            "in": [4],
            "out": [7]
          }
        },
        "businterface": {
          "type": "businterface",
          "port_directions": {
            "clk": "input",
            "reset": "input"
          },
          "connections": {
            "clk": [3],
            "reset": [7]
          }
        }
      }
    }
  }
}
```
</details>
<img src="https://cdn.rawgit.com/nturley/netlistsvg/d01285946e05ee5ce99dc5d0f8025be58b5936a3/doc/generics.svg" >

## Skin File
It pulls the node icons and configuration options from a SVG skin file. Like this one:

<img src="https://cdn.rawgit.com/nturley/netlistsvg/369a0baa31e568995d4cc7ce825bbe50646616c8/lib/default.svg" width="700" height="250">

There is a digital skin that is used by default and we also have an analog skin that can be used.

A skin file can use style tags or inline CSS to style the elements. That will be copied onto the output file. A skin file also defines a library of components to use. Each component has an alias list. It will use that component as a template for any cell with that type that it encounters. Each component defines the position and id of each of its ports so we know where to attach the wires to.

For example, here is a mux definition. It has two aliases: "$pmux" and "$mux". It defines a type name, and a width and height, as well as the position and id of each of it's ports. In general you can rearrange them however you like, and add whatever SVG elements you like inside the template.

```XML
<g s:type="mux" transform="translate(50, 50)" s:width="20" s:height="40">
  <s:alias val="$pmux"/>
  <s:alias val="$mux"/>

  <path d="M0,0 L20,10 L20,30 L0,40 Z"/>

  <g s:x="0" s:y="10" s:pid="A"/>
  <g s:x="0" s:y="30" s:pid="B"/>
  <g s:x="10" s:y="35" s:pid="S"/>
  <g s:x="20" s:y="20" s:pid="Y"/>
</g>
```

In addition to the library of components that are matched to cells, a skin file defines some special nodes. Input/Output ports, constants, Splits/Joins, and the generic node. Splits/Joins and the generic node are particularly tricky because the height and number of ports need to be adjusted depending on the cell. Adjustments to the splits/joins and generic node templates might end up breaking something.

The elkjs layout properties are also defined in the skin file.

```XML
<s:layoutEngine
      org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers="5"
      org.eclipse.elk.spacing.nodeNode= "35"
      org.eclipse.elk.direction="DOWN"
    />
```
Any properties specified here will get passed along to the layout engine. Node and edge properties aren't configurable (yet). Right now I'm setting the priority of $dff.Q to be lower than everything else so that feedback edges on flip flops will go from right to left.

I'm also setting the ports to be fixed position right now, until I figure out a plan for swappable ports.

## Split/Join Wires
It does it's best to be smart about how to split and join buses. I spent a lot of time thinking about it and hacked something together using javascript strings (because I was too lazy to write my own library for processing sequences). At some point I will rewrite it with a sane implementation that doesn't use strings. I think I'm happy with the core algorithm, just the implementation is wonky.

<details>
  <summary>JSON Source</summary>

```json
{
  "modules": {
    "simple": {
      "ports": {
        "inthing": {
          "direction": "input",
          "bits": [ 2, 3, 4, 5 ]
        },
        "outthing": {
          "direction": "output",
          "bits": [ 2, 3 ]
        },
        "outthing2": {
          "direction": "output",
          "bits": [ 2, 3, 5 ]
        },
        "outthing3": {
          "direction": "output",
          "bits": [ 2, 3, 5 ]
        },
        "outthing4": {
          "direction": "output",
          "bits": [ 2 ]
        }
      },
      "cells": {}
    }
  }
}
```
</details>
<img src="https://cdn.rawgit.com/nturley/netlistsvg/d01285946e05ee5ce99dc5d0f8025be58b5936a3/doc/ports_splitjoin.svg" >

* There should only exist one wire for each unique sequence of signals
* Always prefer using an existing signal over adding a new split or join

ElkJS handles all of the wire junctions. Sometimes it does some odd things.
## Input JSON
This is designed to handle Yosys netlist format but we ignore most of it. This is what we are looking at. Currently, we only draw the first module in the modules object.
```json
{
  "modules": {
    "<dont care>": {
      "ports": {
        "<port name>": {
          "direction": "<input|output",
          "bits": [ 2, "1", ... ]
        },
        ...
      },
      "cells": {
        "<cell name>": {
          "type": "<type name",
          "port_directions": {
            "<port name>": "<input|output>",
            ...
          },
          "connections": {
            "<port name>": [ 3, "0", ... ],
            ...
          }
      },
      ...
    }
  }
}
```
## ElkJS
I'm super impressed with this. Layout is a non-trivial problem and this tool is amazing. ELK is written in Java and transpiled to javascript.

This tool is really powerful and I'm still learning the ins and outs of how to use it. ELK is capable of port positioning for instance. This means that potentially I could flag certain ports as being able to be swapped or repositioned and ELK could reorder them to reduce crossings. That's obviously a win for labeled ports on the generic, and split/join, but also a win for cells whose operation is commutative.

ELK is using a layered approach (Sugiyama, Ganser), similar to dot in the Graphviz package. You can read about their algorithm here: https://rtsys.informatik.uni-kiel.de/%7Ebiblio/downloads/papers/jvlc13.pdf

# Status
Still early stages. But it's usable. Skin definition format is still changing.

# Installation/Usage Instructions
```
(install nodejs)
git clone https://github.com/nturley/netlistsvg
cd netlistsvg
npm install
```
At the moment, the invocation looks something like this.
```
node bin/netlistsvg input_json_file [-o output_svg_file] [--skin skin_file]
```
The default value for the output file is out.svg.


## Generating `input_json_file` with Yosys

[Yosys from Clifford Wolf](https://github.com/cliffordwolf/yosys) can be used to generate the `input_json_file` using [the `write_json` command](http://www.clifford.at/yosys/cmd_json.html).

Unless you are doing something special you will want to use [the `prep` command](http://www.clifford.at/yosys/cmd_prep.html). Some examples are provided below and you can find some runnable examples which go from Verilog to diagrams in the [examples directory](./examples) (with example Makefile).

#### Generate top level diagram

This command will generate a diagram of the top module with all the inner modules shown as boxes.

```
yosys -p "prep -top my_top_module; write_json output.json" input.v
```

#### Generate logic diagram

You can give it the `-flatten` argument to  [the `prep` command](http://www.clifford.at/yosys/cmd_prep.html) if you want Yosys to convert everything into low level logic. Only basic logic cells and black boxes will exist after flattening.

```
yosys -p "prep -top my_top_module -flatten; write_json output.json" input.v
```

### Generate AND (or not) and inverter (NOT) diagram

It is also frequently common that you want to create a diagram only using AND and NOT (or NAND and NOT) cells. ([This is called an AIG](https://en.wikipedia.org/wiki/And-inverter_graph).) This can be done with Yosys' [`aigmap` command](http://www.clifford.at/yosys/cmd_proc.html).

```
yosys -p "prep -top my_top_module; aigmap; write_json output.json" input.v
```

## Declarative Quine/Karnaugh exercises

`vzpac logic exercises instances.yml -o chapter.md --manifest assets.yml`
accepts `generate.kind: minimize` alongside the existing Boolean and prose
models. Each instance supplies ordered `variables` (MSB first, 1–6 identifiers)
and a quoted native `table` containing exactly `2^variables.length` characters
from `0`, `1`, and `x`. Extra rows are rejected, not truncated.

```yaml
generate:
  kind: minimize
  variables: [a, b, c, d]
  table: '1011000110101110'
  timing: {andFanIn: 3, andDelay: 2, orFanIn: 3, orDelay: 3}
```

The model calls the existing `quine.synthesize`, verifies its chosen cover on
every care row, and emits the native asset command
`vzpac quine TABLE -r VARS -c -s {qdir}/assets/ID`. Optional `expression`
uses the existing scalar Boolean grammar and must agree on every care row.
`expressionLatex` is rendered from that checked expression.

Inline collection fields include `primeCount`, `essentialCount`,
`nonessentialCount`, `essentialLatex`, `solutionLatex`, `solutionCount` (number
of selected terms, **not** alternative solutions), `solutionLiteralCount`,
`additionalCount`, and `uncoveredCount`. Essentials refer to the original
full prime chart, not terms forced after dominance. `dominatingLabels`,
`dominatedLabels`, and `secondaryEssentialCount` describe the native chart
reductions. Teaching tables (`truthTable`, `orderZeroTable`,
`markedOrderZeroTable`, `orderOneTable`), reduction pairs and prime labels
come from the same native synthesis.

`minimumCoverCount` counts all distinct prime subsets with the fewest terms,
before dominance can discard equal-cost alternatives. Enumeration uses the
native prime set and stops with an explicit error after 1,000,000 search nodes.
`minimumTermCount`, `minimumLiteralCount`, and `minimumLiteralCoverCount`
separately report the term optimum and the literal optimum among term-minimum
covers. These statistics do not change the native selected cover or its
historical tie-breaking. `dcTermSavings` and `dcLiteralSavings` compare these
optima against a second native synthesis with don't-cares set to zero.

Optional timing uses balanced AND/OR fan-in trees and excludes inversion
delay (complemented inputs are supplied). Fan-ins must be integers from 2 to
64; delays must be finite and non-negative. `andLevels`, `orLevels`,
`totalDelay`, and `timingLatex` derive from the selected cover and the same
declared delays. For the example above the critical path is
`1 × 2 + 2 × 3 = 8`; no solution delay is stored independently of the prompt.

## Native sequential exercises

`vzpac seq exercises instances.yml -o chapter.md --manifest assets.yml`
uses the shared exercise collection, including `mode: inline`, canonical
chapter placeholders and `base_assets`. Then run `vzpac gen-assets assets.yml`.
One simulation supplies both the answer and masked waveform; illustrations
that are not exercises can remain in the base manifest.

An HDL row supplies this structured `generate` mapping:

```yaml
generate:
  kind: sequential
  circuit:
    inputs: [I, clk, rst]
    outputs: [Z]
    wires: [d, q]
    equations: {d: 'I ^ q', Z: 'q'}
    flops:
      - {type: dffms, name: ff, ports: [d, clk, rst, q]}
    latexVariants:
      time: {I: 'I_t', q: 'Q_t'}
  testbench:
    regs: {clk: 0, i: 0, rst: 0}
    wires: [z]
    ports: [i, clk, rst, z]
    clock: {signal: clk, halfPeriod: 2}
    events:
      - {delay: 0, set: {rst: 1}}
      - {delay: 1, set: {rst: 0}}
      - {delay: 4, set: {i: 1}}
      - {delay: 12, finish: true}
  wave:
    renderer: wave
    signals: [test.i, test.z, test.dut.d, test.dut.q, test.clk, test.rst]
    end: 18
    whitelist: [I, CLK, RST]
```

The fixed hierarchy is `test.dut` (`test0` circuit module). Primitive instances,
unused wires/registers, port ordering, initial values and zero-delay events are
retained. Events use **relative** delays; assignments in a `set` occur in mapping
order after that delay. The final event must be `finish: true`.
Bits accept `0`, `1`, `'x'`, `'z'`. Clock half-period is a positive integer;
delays and total simulation duration are bounded at 1,000,000 time units.
There are at most 128 scalar declarations, 32 flip-flops and 4,096 events.

Primitive types are `dffms` (reset 0), `dffmsn` (reset 1), `rsffms` and
`tffms` (both reset 0). They intentionally retain two independent processes:
`always @(rst)` resetting only when asserted, and `always @(negedge clk)`
updating state. **No reset priority is introduced.** The RS primitive retains
`if (s | r) Q <= !r & s; else Q <= Q`; T holds when low. Optional
`circuit.primitivePorts: {dffms: [d, clk, rst, Q]}` preserves legacy formal
spelling positionally without changing its semantics.

Equations use the existing scalar Boolean AST (`~`, `&`, `^`, `|`, parentheses,
0/1), producing both Verilog and LaTeX. Each expression may reference at most
10 scalar signals; unrelated clock/reset/unused declarations do not consume
that bound. There is no JavaScript sequential simulator: Icarus/vvp is truth.
For native four-state multiplexing use
`F: {mux: {select: sel, whenTrue: q, whenFalse: I}}`: the formula is derived
from those expressions, while RTL retains `?:` rather than an SOP rewrite.
Inline fields include `${ID.dLatex}`, `${ID.dFunctionalLatex}`,
`${ID.dTimeLatex}` (the declared `time` variant), and `${ID.qReset}`.
The Boolean model's additive `compiledExpressions` result exposes rendered
`verilog`/`latex`, not its AST.

The adapter emits `test.v`, `test_cb.v`, and the historical artifact basenames:
`${ID.diagramAssets}.pdf` → `test-diag.pdf`,
`${ID.waveAssets}.pdf` → `test-wave.pdf`, and
`${ID.maskedWaveAssets}.pdf` → `test-wave-whitelisted.pdf`.
`wave` is the default renderer; omitting `signals` preserves the native
all-signals command. Its whitelist uses the renderer's uppercase display names;
legacy unmatched whitelist names are retained. Netlist generation has no extra
flags by default. Explicit `netlist: {mode: simple, ffIndices: [0, 1]}` enables
the corresponding native options (`aig` is also supported). `mode: techmap`
selects the current sequential preset `-v -k --script 'prep -auto-top; techmap; opt;'`. Optional
`netlist.skin` is a path relative to the input YAML. Paths and command arguments
use the collection's quoting/rebasing helpers.

For packed-bus waveforms, add e.g.
`circuit.buses: {stateBus: [q1, q0], inputBus: [i1, i0]}` (MSB first,
2–32 scalar members), and set:

```yaml
wave:
  renderer: sootty
  signals: [inputBus, stateBus]
  whitelist: [inputBus]
  end: 28
  radix: 2
```

This emits native vector aliases, runs `sootty`, masks the non-whitelisted
rows with `vzpac sootty mask`, then converts both SVGs with `cairosvg`.
Sootty chooses row order; input order is not promised. Selection and whitelist
names are case-sensitive **basenames only**. Each selected basename must be
unique across every VCD declaration, including unselected primitive aliases.
Thus `clk` and primitive `Q` are often ambiguous and are rejected rather than
masking a potentially wrong row. Choose distinctive bus aliases. Scalar `wave`
does not render packed buses; select scalar signals explicitly if aliases exist.
Sootty/cairosvg are needed only for this renderer.

Prose-only rows use `kind: prose` with the existing Boolean
`variables`, `expressions`, `latexVariants` and/or meaningful `parameters`.
An optional `circuitFigure` path, relative to the input YAML, exposes
`${ID.circuitFigure}` rebased to the output chapter. It references the canonical
figure without generating a new artifact or inventing an exercise solution.
The domain test target includes native Icarus/vvp regressions for reset/edge
semantics, mux X behavior, aliases, explicit timing and shell-safe paths.

## Native FSM exercises

`vzpac fsm exercises instances.yml -o chapter.md --manifest assets.yml`
uses the shared inline collection; `vz-fsm exercises` is the standalone
equivalent. Run `vzpac gen-assets assets.yml` to execute its native FSM jobs.
There are no new Markdown templates or alternate synthesis algorithms.

```yaml
mode: inline
chapter: notes.md
tag: fsm
passthrough: [sequential-example]
sections:
  - title: State machines
    exercises:
      - id: machine
        asset_name: fsm
        generate:
          flipFlop: SR
          fsm:
            type: mealy
            inputSize: 1
            outputSize: 1
            transitions:
              - a: [{a: [0]}, {'b/b280': [1]}]
              - b: [{a: [1]}, {b: [0]}]
            encodingSize: 2
            encoding: {a: [0, 0], b: [1, 1]}
```

`generate.fsm` is the native FSM JSON structure, not a second state-machine
language. Transition columns follow binary input order, MSB first. Routing
annotations such as `s_2/b280` and `graphics` labels/options are retained.
Moore outputs are one vector per state; Mealy outputs belong to transitions.
`initial` is optional: omission means no initial arrow, not an inferred initial
state. Explicit unknown initial or destination states are rejected.
Encoding codes must be unique numeric bit vectors covering exactly the states;
unused codes intentionally remain native don't-cares.

`draw: true` emits only the diagram and needs no encoding; `encodingSize` and
`encoding` must be supplied together if either is present. Otherwise the native
backend emits **all** D, SR, T and JK excitation tables, expressions and
Karnaugh artifacts, plus transition/output/encoding tables. Optional
`flipFlop: D|SR|T|JK` selects the requested prompt/answer fields, never removes
native outputs. `randomSeed` defaults to 1. The collection bounds models to
32 states, 1–4 input bits, 1–16 output bits, 1–5 encoding bits and, for full
synthesis, at most 6 combined state/input bits. These bounds limit native
exhaustive synthesis; the adapter neither completes missing transitions nor
minimizes a different model.

Each job writes `fsm.json`. Its output prefix is `<id>/assets/<asset_name>`,
where `asset_name` defaults to the ID; e.g. `asset_name: fsm` preserves
historical `results-*` diagram basenames. Native suffixes are unchanged.
Inline values include `type`, `inputSize`, `outputSize`, `stateCount`,
`encodingSize`, `encodingLatex` (bare math), `stateTableMarkdown`,
`encodingTableMarkdown`, and the selected `flipFlop`.

Rebased paths include `diagramAssets`, `stateEncodingAssets`,
`transitionTableAssets`, `outputTableAssets`, and
`dExcitationTableAssets`/`srExcitationTableAssets`/`tExcitationTableAssets`/
`jkExcitationTableAssets`. Table fields also have `BlankAssets` and
`ShortBlankAssets` variants. Per-bit fields include `d0ExpressionAssets`,
`s0ExpressionAssets`, `r0ExpressionAssets`, `t0ExpressionAssets`,
`j0ExpressionAssets`, `k0ExpressionAssets`, `o0ExpressionAssets` and corresponding
`KarnaughAssets`. Append the desired `.pdf` or `.svg`.
Selected aliases are `excitationTableAssets` (with blank variants) and
`excitation0ExpressionAssets`, etc., in bit-major/pin order.
`${ID.excitationExpressionsMarkdown}` renders the complete selected expression
block, with rebased image/edit links and stable figure IDs; changing SR to D
also changes the number of figures. Its pedagogical order is S bits then R bits
for SR, and bit-major order for JK/D/T.

For a prose-only request, use
`generate: {kind: prose, request: {startSignal: start, completionCondition: 'the computation completes'}}`.
The two fields interpolate the existing prompt. This row produces a manual
manifest entry only: no inferred FSM, named completion signal, restart
semantics, encoding or solution.

To compose domains, the FSM collection first materializes an intermediate
chapter and manifest. The sequential collection then uses that chapter and
the FSM manifest as `base_assets`. An inline document may declare
`passthrough: [exact-other-exercise-ids]`; only placeholders belonging to those
IDs survive that pass. Owned/deferred ID overlap and other unknown fields
remain errors, all owned rows must still be referenced, and the final pass
must omit passthrough to reject unresolved placeholders. Relative paths
rebase through both passes, including manifests outside the chapter directory.
Adapters may provide `generated.markdown` fragments, resolved strictly against
their own final values and rebased asset paths; field collisions are rejected.

The shared native API is `createFSMArtifacts(fsm, {draw, randomSeed})`, returning
the existing artifact array without file I/O, and `getTransition(fsm, row)`,
the existing routing-aware transition parser. Both the CLI and adapter use
that native implementation. In the PAC consumer, `sc-syn-exe6/7` remain
independently declared HDL exercises reused by the FSM chapter: changing their
linked FSM exercises also requires updating the corresponding HDL declaration.
No automatic FSM synthesis from Verilog or automatic FSM-to-HDL conversion is
claimed.

Focused behavior tests live in `bin/lib/vz-fsm/{model,exercises}.test.js` and
cover excitation invariants, don't-cares, transition/encoding mutations,
draw-only models, selected-FF blocks, shell-safe paths and two-stage composition.

## Native ISA exercise collections

`vzpac isa exercises instances.yml -o chapter.md --manifest isa-assets.yml`
uses the shared inline collection adapter. Unlike diagram domains, it executes
verification **during generation**: two independent statically linked RV64
programs run through GCC/QEMU in `vzpac-rv-exec:latest`, the same native lifecycle
used by `vzpac rv-exec program.s init.c`. The legacy CLI and its before/after
stdout format are unchanged. The existing image inspection/build lifecycle is
shared; image archive management remains an operator responsibility.

```yaml
mode: inline
chapter: notes.md
tag: isa
sections:
  - title: Signed arithmetic
    exercises:
      - id: addition
        generate:
          kind: program
          parameters: { increment: 3 }
          fragments:
            c: "x += ${increment};"
            asm: |
              ld a0,x
              addi a0,a0,${increment}
              la t0,x
              sd a0,0(t0)
          verify:
            - name: negative
              declarations: "int64_t x = -5;"
              asm: "${asm}"
              reference: "${c}"
              observe: [{ name: x, type: int64_t }]
```

The canonical chapter uses `${addition.c}`, `${addition.asm}` and
`${addition.value_x}` (here `-2`). `parameters` are scalar values; quote all
integers outside JavaScript's safe-integer range. `fragments` recursively
interpolate parameters and other fragments, with missing/cyclic references
rejected. Exactly one trailing newline is removed from fragments exposed to
chapter interpolation, not from their internally composed executable sources.

Every `program` requires nonempty `verify` cases with unique `name` values.
Each case supplies typed C global `declarations`, a C function-body `reference`,
and either an assembly body `asm` or complete `asmSource`. Complete sources use
`entry` (default `main`), privately renamed to avoid the harness entry. Optional
`helpers` are identical C definitions in both processes; optional `asmSupport`
provides additional assembly definitions. Helper functions are explicit
deterministic fixtures, not an assumption about every possible external
function. Use the same named fragments for displayed and executable code.

Optional `before`/`after` assembly binds pedagogical registers to initialized
globals and captures results. These bindings are not ABI parameter claims.
The wrapper preserves `ra` and all integer callee-saved registers in an aligned
frame. Body `ret`/`jr ra` returns pass through result capture and restoration;
the pedagogical `f:` entry does not shadow a separately linked helper `f`.
Leading labelled string/data directives are relocated to `.rodata` without
executing their bytes. Legacy `;;` comments are transported as GNU `#` comments.
Complete function sources remain responsible for their own internal ABI/frame
discipline; this is not a translator for arbitrary C or arbitrary assembly.

`observe` entries have `name`, explicit `type` (`int8_t`/`uint8_t` through
`int64_t`/`uint64_t`) and optional positive array `length`. C compile-time type
checks reject incorrectly declared observation widths. State is transported
as exact decimal text and range-checked with BigInt, never rounded through
Number. Application stdout is compared exactly even when globals are observed.
For stdout-only cases use `stdout: true`; include `stdio.h`, `stdint.h`,
`inttypes.h`, `stddef.h` and `stdlib.h` implicitly in both harnesses.

Results come from actual execution: `result` is the first case's final state as
C declarations, `stdout` its application output, and `value_NAME` its scalar
decimal value or comma-space-separated array values. Named cases also expose
`result_CASE`, `stdout_CASE` and `value_CASE_NAME`. `verification` summarizes
case evidence, **not a universal equivalence proof**. Domain/precondition
justifications belong in the canonical chapter; do not hide erroneous
exercises behind restricted fixtures.

Legitimate incomplete/narrative listings use `kind: fragment` with a required
`reason` and no `verify`. A verified program may additionally classify partial
display stages with `stages: {fragmentName: reason}`. Fragment classification
does not claim an executed result. The manifest records classification, actual
state/stdout evidence, and complete reproducible native sources as manual
inputs; no `gen-assets` step is required to obtain answers.

Compilation, mismatch, missing observation and timeout failures abort generation
before either output is written. `timeout` defaults to 10 seconds per native
process (maximum 300); compilation has a separate outer deadline. Failed or
timed-out containers and temporary sources are cleaned up. Legacy `rv-exec
--keep` retains native sources for inspection.

`make -C bin test-domains` includes pure model/collection contract tests.
`make -C bin test-isa-native` explicitly runs GCC/QEMU behavioral regressions
(requires Docker): high-bit unsigned branch mismatch, signed word width,
exact 64-bit arrays, helper calls/register capture, literal data/stdout,
complete `main` handling, observation type errors, timeout and
publication only after native comparison. No simulator or Markdown template is
introduced.
