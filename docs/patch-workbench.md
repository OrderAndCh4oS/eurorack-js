# Patch Workbench Reference

The Patch Workbench is a client-side editor and diagnostic console for building Eurorack patches with JavaScript. A script describes a rack; it does not process audio itself. **Validate** turns the script into a candidate v3 patch and checks it without changing the rack. **Apply** validates and then atomically replaces the live rack.

Patch scripts are trusted code that you choose to run in your own browser. Evaluation happens in a disposable worker with a two-second timeout so an accidental infinite loop does not freeze the rack page. Imported scripts are never run automatically.

For a guided first patch, read the [Patch Workbench Guide](patch-workbench-guide.md).

## Opening the Workbench

Select **Code** in the main toolbar, or press Ctrl+` on Windows/Linux and Command+` on macOS. The drawer contains:

- A named local-script bank.
- The syntax-highlighted patch editor and completion menu.
- **Snapshot**, **Validate**, and **Apply** controls.
- A diagnostic log and command input.
- Links back to this reference and the tutorial.

The drawer can be resized from its top edge. It switches to a stacked layout on narrow screens. Its surrounding controls and diagnostics follow the active Industrial or Classic light/dark theme immediately, while the code canvas, syntax palette, and completion menu remain fixed for consistent readability.

The first time it opens in a browser session, **Current Rack** contains a source snapshot of the live graphical patch. It is session-only and read-only; typing or saving creates a named local script, so reopening the workbench later in the same session does not replace work in progress.

| Shortcut | Action |
|---|---|
| Ctrl/Command+S | Save the named script locally, validate, and apply atomically |
| Ctrl/Command+Enter | Validate and apply |
| Ctrl/Command+Shift+Enter | Validate only |
| Ctrl/Command+Space | Open completion |
| Tab | Accept a completion, or indent when completion is closed |
| Arrow Up/Down | Select a completion |
| Escape | Close completion |
| Ctrl/Command+` | Toggle the workbench |

## Builder API

A script must call `patch()` exactly once. The returned builder is mutable and every method returns the same builder, so calls can be chained or made from ordinary JavaScript control flow.

<!-- executable-patch -->
```javascript
const p = patch()

p.module('vco', 'osc', { coarse: 0.3 })
  .module('out', 'main', { volume: 0.65 })
  .connect('osc.triangle', 'main.L')
  .connect('osc.triangle', 'main.R')
```

### `patch()`

Creates the single patch builder for the evaluation. Zero or multiple calls are errors. A script does not need to `return` or export the builder.

### `.module(type, params = {}, options = {})` and `.module(type, name, params = {}, placement = {})`

Adds a module instance. `type` is the registered module ID, such as `vco`, `vcf`, or `midi-cv`. The name is optional: unnamed instances receive canonical names such as `vco_1`, `vco_2`, and `vcf_1`. An explicit name identifies the instance in parameter changes and connections.

Use either overload according to what reads best:

```javascript
p.module('vco')
p.module('vcf', { cutoff: 0.55 })
p.module('vcf', 'filter', { cutoff: 0.55, resonance: 0.3 }, { row: 2, index: 0 })
p.module('out', { volume: 0.65 }, { name: 'main', row: 2, index: 1 })
```

`params` may contain any parameter declared by the module UI contract. Placement accepts positive `row` and zero-based `index` values. The object overload also accepts an optional `name`; `id` is supported as an equivalent programmatic alias. If `row` is omitted, modules are placed in declaration order in the first row with enough free HP. A new row is added when required. Duplicate names, missing module types, invalid placement, and overfilled explicit rows are errors.

### `.add(type, params = {}, options = {})`

Adds a module and returns its resolved instance name. Names increment independently per type using the canonical convention: `vco_1`, `vco_2`, `vcf_1`, and so on. Explicit declarations such as `module('vco', 'vco_3')` reserve the counter, making the next automatic VCO `vco_4`.

Pass `{ name: 'bassOsc' }` to override the generated name. `id` remains an equivalent alias for programmatic builders. Options also accept `row` and `index`.

```javascript
const first = p.add('vco')
const second = p.add('vco')
const bass = p.add('vco', { coarse: 0.2 }, { name: 'bassOsc' })
```

### `.port(moduleId, portId)`

Returns a lossless `{ module, port }` endpoint. This is useful in reusable functions and works with any legal instance ID.

### `.set(id, param, value)` and `.set(id, values)`

Changes parameters on a module declared earlier in the script. The object form is useful for groups and the scalar form is useful in loops:

<!-- executable-patch -->
```javascript
const p = patch().module('seq', 'steps').module('clk', 'clock')

for (let step = 1; step <= 8; step++) {
  p.set('steps', `step${step}`, (step - 1) / 7)
  p.set('steps', `gate${step}`, step % 2)
}

p.set('clock', { rate: 0.24, pause: 0 })
  .connect('clock.clock', 'steps.clock')
```

Unknown parameters and non-finite values are errors. Values outside panel ranges produce warnings because the canonical v3 patch format permits finite values.

### Control states

Patch source stores canonical numeric values. Completion displays the panel meaning beside each value:

- Knob: declared minimum, maximum, default, and step.
- Named switch: its zero-based position, for example `2 — LP`.
- Binary switch or toggle: `0 — Off`, `1 — On`.
- Button bank: one of its declared numeric values.
- Momentary action: `0 — Released`, `1 — Held`.
- Trigger action: `0 — Idle`, `1 — Fire on Apply`.

Momentary or trigger values stored as `1` produce a warning because loading the patch may hold or fire the action. Structured values declared through `ui.state` are accepted as JSON-like objects, arrays, strings, booleans, and finite numbers, but deeper completion requires the module to expose a schema in a future contract revision.

<!-- executable-patch -->
```javascript
patch()
  .module('comp', 'compressor', {
    mode: 1,
    detector: 1,
    filterMode: 2,
    bypass: 0
  })
  .module('loop', 'looper', {
    reverse: 1,
    halfSpeed: 0,
    mode: 2,
    clear: 0
  })
```

### `.connect(from, to)`

Connects one output to one input. The compact form is `instance.port`:

```javascript
p.connect('osc.ramp', 'filter.audio')
```

For an unusual instance or port containing a dot, use lossless endpoint objects:

```javascript
p.connect({ module: 'osc.main', port: 'ramp' }, { module: 'filter.main', port: 'audio' })
```

Outputs may fan out to multiple inputs. Each input may have only one source. A duplicate destination is a validation error. Feedback is legal, but every cable inside a feedback component receives an explicit one-block delay.

Completion knows which argument is the source and destination. Source completion lists outputs; destination completion lists inputs and marks already occupied inputs unavailable. Each entry includes signal type and voltage information from the module contract.

### `.midi(key, mapping)`

Adds a MIDI CC mapping. Keys use `channel:cc`; channels are zero-based. Completion offers valid instances and parameters.

```javascript
p.midi('0:74', { moduleId: 'filter', paramId: 'cutoff', min: 0, max: 1 })
```

## JavaScript and Dynamic Patches

Variables, functions, loops, template strings, arrays, and conditionals can generate a patch. Evaluation is synchronous; top-level `await` and module imports are not part of the v1 patch language.

<!-- executable-patch -->
```javascript
const p = patch()

for (let voice = 1; voice <= 3; voice++) {
  p.module('vco', `osc${voice}`, { coarse: 0.27 + voice * 0.015 })
}

p.module('mix', 'mix1', { lvl1: 0.3, lvl2: 0.3, lvl3: 0.3 })
  .module('out', 'main', { volume: 0.6 })
  .connect('osc1.triangle', 'mix1.in1')
  .connect('osc2.triangle', 'mix1.in2')
  .connect('osc3.triangle', 'mix1.in3')
  .connect('mix1.out', 'main.L')
  .connect('mix1.out', 'main.R')
```

Literal `.module()` declarations complete immediately. Modules generated by loops or helper functions enter the completion model after a successful Validate or Apply. Validated-only suggestions are labelled in the completion detail.

## Reusable Voices and Systems

The language does not hard-code a voice concept. A reusable system is an ordinary function that receives the builder, adds any module combination, wires its internal graph, and returns the endpoints callers need. Repeated calls create independently incremented systems; callers may supply stable names where useful.

<!-- executable-patch -->
```javascript
function addVoice(p, { name = null, coarse = 0.3 } = {}) {
  const osc = p.add('vco', { coarse }, name ? { name: `${name}_osc` } : {})
  const filter = p.add('vcf', { cutoff: 0.55 }, name ? { name: `${name}_filter` } : {})
  p.connect(p.port(osc, 'ramp'), p.port(filter, 'audio'))
  return { output: p.port(filter, 'lpf'), pitch: p.port(osc, 'vOct') }
}

const p = patch()
const lead = addVoice(p)
const bass = addVoice(p, { name: 'bass', coarse: 0.2 })
const mixer = p.add('mix')
const main = p.add('out')

p.connect(lead.output, p.port(mixer, 'in1'))
  .connect(bass.output, p.port(mixer, 'in2'))
  .connect(p.port(mixer, 'out'), p.port(main, 'L'))
  .connect(p.port(mixer, 'out'), p.port(main, 'R'))
```

The same pattern works for drum kits, modulation buses, sequencer lanes, effect chains, and complete voices. Returning input endpoints such as `pitch` lets a higher-level system connect shared sequencing into each repeated voice.

## Validate, Apply, and Snapshot

**Validate** performs these steps without mutating the rack:

1. Evaluate the script in a disposable worker.
2. Resolve module and plugin contracts from the live registry.
3. Place modules and enforce the 84HP row limit.
4. Validate parameters, MIDI mappings, ports, and occupied inputs.
5. Instantiate temporary DSP modules and compile their routing graph.
6. Report processing order, feedback delays, and warnings.

**Apply** runs the same validation, loads the candidate through `RackHost.loadPatch()`, waits for AudioWorklet topology acknowledgement, and then rerenders. The host rolls back to the previous patch if activation fails. Apply does not start or stop audio.

**Snapshot** replaces the editor with deterministic, consistently spaced code describing the current graphical rack. It emits one module declaration per physical line, rounds numeric values to five decimal places, uses the type-first named overload to preserve every current instance name, and records exact placement, cables, MIDI mappings, structured state, and non-default controls. Manual rack changes remain valid; a drift warning simply means the rack no longer matches the last script Apply. Loading a JavaScript file or reopening a named local script preserves its source whitespace exactly.

## Console Commands

| Command | Result |
|---|---|
| `:help` | Command summary and documentation links |
| `:modules [filter]` | Registered module types, optionally filtered |
| `:describe <type-or-instance>` | UI contract and current instance parameters |
| `:rack` | Compact current rack state |
| `:json` | Pretty canonical v3 patch JSON |
| `:validate` | Validate the editor |
| `:apply` | Validate and apply the editor |
| `:snapshot` | Convert the graphical rack to source |
| `:profile start` | Enable and reset AudioWorklet timing samples |
| `:profile stop` | Stop collecting timing samples |
| `:profile report` | Show block/module p50, p95, and p99 timing |
| `:clear` | Clear the bounded diagnostic log |

Profiling requires running audio. Block p99 utilization compares the p99 processing time with the Web Audio render deadline; values approaching 100% indicate dropout risk.

## Scripts, Patches, and Sharing

Named scripts are autosaved locally in a versioned script bank. **New**, rename, **Delete**, **Load**, and **Copy** operate on source. **Save** immediately persists the selected script and applies it. The session-only Current Rack and bundled Starter Voice are read-only; editing either creates a local copy.

Scripts and patches remain separate:

- Applying a script creates an ordinary in-memory v3 patch.
- Main-toolbar Save, Export, and Share controls operate on compiled patch state.
- Workbench Load reads JavaScript source into a new local script but never evaluates it automatically.
- Workbench Save (or Ctrl/Command+S) saves source locally, validates it, and applies the resulting patch.
- Shared patch URLs do not embed source code in v1.

## Troubleshooting

- **No sound:** start audio, include an `out` module, connect both desired output channels, and inspect warnings.
- **No socket suggestion:** declare the module literally or Validate once if it was generated dynamically.
- **Input unavailable:** another `.connect()` already targets it. Remove that connection or route through a mixer.
- **Unknown parameter/port:** use completion or `:describe`; panel labels are not always contract IDs.
- **Script timed out:** remove an infinite or excessively large loop. Evaluation stops after two seconds.
- **Action fires on Apply:** keep trigger and momentary parameters at `0` unless the side effect is intentional.
- **Rack drift:** Snapshot to capture graphical edits, or Apply again to restore the script-defined graph.
- **High p99 utilization:** use `:profile report` to identify expensive modules and simplify the patch.

## Deliberate v1 Limits

The workbench does not provide a general JavaScript language server, automatic evaluation while typing, per-port voltage probes, embedded source in patch URLs, asynchronous scripts, or Strudel-style cycle scheduling. Timing and modulation remain the job of rack modules such as CLK, SEQ, LFO, and function generators.
