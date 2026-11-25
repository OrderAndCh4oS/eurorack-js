# Patch Workbench Reference

The Patch Workbench has **Patch** and **Modules** tabs. The Patch tab builds racks with JavaScript; the Modules tab shows built-in source and edits your own browser-local module definitions. A patch script describes a rack; it does not process audio itself. **Validate** turns the patch script into a candidate v3 patch and checks it without changing the rack. **Apply** uses that exact candidate, or validates first if the source changed. Random choices are not rerun between Validate and Apply. A changed rack requires validation again.

Patch-script evaluation happens in a disposable worker inside an opaque-origin sandbox with a two-second timeout. Network requests, app storage and page access are blocked. There is no main-thread evaluation fallback. A script can contain up to 128 KiB of UTF-8 source and create a rack of up to 256 modules and 2048 cables across 32 rows. Explicit placement uses rows 1–32 and indexes 0–255. Evaluation results are limited to 1 MiB. This boundary has no hard memory quota. Loaded patch script files are never run automatically. When activated, module definitions run separately as trusted JavaScript outside the patch-script sandbox.

Applying a validated draft keeps the open patch's identity, credits and saved baseline. Saving or publishing the result requires a separate action. Drafts expire after 15 minutes. If the rack has unsaved edits, the manual **Apply** button offers Save, Discard and Cancel. WebMCP keeps those edits by default and lets the caller explicitly apply the draft over them. [WebMCP draft application](webmcp.md#how-drafts-work)

For a guided first patch, read the [Patch Workbench Guide](patch-workbench-guide.md).

## Opening the Workbench

Select **Code** in the main toolbar, or press Ctrl+` on Windows/Linux and Command+` on macOS. The **Patch** tab contains:

- A named local-script bank.
- The syntax-highlighted patch editor and completion menu.
- **Snapshot**, **Validate**, and **Apply** controls.
- A diagnostic log and command input.
- Guide and Reference links to the documentation pages.

The **Modules** tab contains a searchable source browser and an editor for your own modules. See [Module source](#module-source) for its controls and storage behavior.

The drawer can be resized from its top edge. It switches to a stacked layout on narrow screens. Its controls follow the factory paper, ink and orange palette; the code canvas uses its own syntax colours for readability.

**Debug**, beside Code, shows the same connection checks as validation and highlights affected modules. It follows CV, gate and audio paths, accepts feedback and monitor destinations, and does not flag spare individual jacks. The checks operate at module level; they cannot prove audibility or identify unused internal channels. See [WebMCP tools](webmcp.md) for browser-agent access to the same validation and apply flow.

The first time it opens after loading the app, **Current Rack** contains a source snapshot of the live graphical patch. It lasts until the page is reloaded. Typing or saving creates a named local script; reopening the drawer does not replace work in progress.

Snapshots use a single `patch()` chain for up to 256 module, connection and MIDI mapping calls combined. Larger snapshots declare `const rack = patch()` and put each call on its own statement. An older standalone `patch()` chain that exceeds the JavaScript compiler’s stack can still be validated and applied. Your saved source keeps its original formatting.

| Shortcut | Action |
|---|---|
| Ctrl/Command+S | Save source locally, then apply the validated patch |
| Ctrl/Command+Enter | Apply the validated patch; validate first if needed |
| Ctrl/Command+Shift+Enter | Validate only |
| Ctrl/Command+Space | Open completion |
| Tab | Accept a completion, or indent when completion is closed |
| Arrow Up/Down | Select a completion |
| Escape | Close completion |
| Ctrl/Command+` | Toggle the workbench |

These shortcuts apply to the Patch tab. Ctrl/Command+S also works elsewhere in that tab; the toggle shortcut works throughout the app. Enter also accepts the selected completion. In the module editor, Ctrl/Command+S saves the draft without running it.

## Module Source

The **Modules** tab lists **Your modules** first, then **Built-in modules**. Search matches module names and IDs. Built-in source is read-only and fetched only when selected, then reused within the session. **Copy code** copies the source; **View on GitHub** opens its repository file.

| Control | Behavior |
| --- | --- |
| **New module** | Create a browser-local draft from a starter definition |
| **Import own module** | Read your own `.js` or `.mjs` file into a new draft without executing it |
| **Save** | Persist the selected draft in local storage without running it |
| **Use module** | Save and execute the definition, retain its executable revision, and add an instance to the rack |

Local source must be a self-contained ES module whose default export is a module definition. Import declarations, dynamic imports and re-exports are unsupported. This is an authoring constraint, not isolation: activated module code is trusted JavaScript outside the patch evaluator's sandbox. Develop code you own and have reviewed, following [Creating Modules](creating-modules.md).

An executable revision has an immutable `local-<lowercase ULID>` ID. Editing a draft does not replace the revision used by an existing patch. Drafts and executable revisions are stored only in this browser's local storage, with no account sync. Revisions load when you use a module or open a browser-saved patch that needs them; browsing source does not activate them.

Account saves and public patches accept built-in modules only. Snapshot links and patch state do not carry local module source, so another browser cannot recreate those dependencies. Clearing site storage removes the local drafts and revisions. Keep source backups and use the [contribution workflow](creating-modules.md#contribute-a-module) for modules intended for public use.

## Builder API

A script must call `patch()` exactly once. The returned builder is mutable. `.module()`, `.set()`, `.connect()`, and `.midi()` return the same builder for chaining; `.add()` returns the resolved module name and `.port()` returns an endpoint object. Calls can also be made from ordinary JavaScript control flow.

<!-- executable-patch -->
```javascript
const p = patch()

p.module('vco', 'osc', { coarse: 0.3 })
p.module('out', 'main', { volume: 0.65 })
p.connect('osc.triangle', 'main.L')
p.connect('osc.triangle', 'main.R')
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
const p = patch()
p.module('seq', 'steps')
p.module('clk', 'clock')

for (let step = 1; step <= 8; step++) {
  p.set('steps', `step${step}`, (step - 1) / 7)
  p.set('steps', `gate${step}`, step % 2)
}

p.set('clock', { rate: 0.24, pause: 0 })
p.connect('clock.clock', 'steps.clock')
```

The compiler rejects unknown parameters, non-finite values and settings outside the control's declared range, step grid or list of choices. Knob steps start at the declared minimum. Patch-persisted structured values use the module's `ui.state` declaration.

### Control states

Patch source stores canonical numeric values. Completion displays the panel meaning beside each value:

- Knob: declared minimum, maximum, and default.
- Named switch: its zero-based position, for example `2 — LP`.
- Binary switch or toggle: `0 — Off`, `1 — On`.
- Button bank: one of its declared numeric values.
- Momentary action: `0 — Released`, `1 — Held`.
- Trigger action: `0 — Idle`, `1 — Fire on Apply`.

Non-zero momentary or trigger values produce a warning because loading the patch may hold or fire the action. Structured values declared through `ui.state` are accepted as JSON-like objects, arrays, strings, booleans, and finite numbers. Completion offers the default state value; it does not complete nested fields.

<!-- executable-patch -->
```javascript
patch()
  .module('comp', 'compressor', { mode: 1, detector: 1, filterMode: 2, bypass: 0 })
  .module('loop', 'looper', { reverse: 1, halfSpeed: 0, mode: 2, clear: 0 })
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

For string endpoints, completion lists outputs in the first argument and inputs in the second, marking inputs occupied by scanned or previously validated connections unavailable. Object endpoints also offer module and port names, but do not mark occupied inputs. Each socket entry includes signal type and voltage information from the module contract. Accepting a completion replaces the complete current token, including any text after a caret positioned in the middle of a module type, socket, parameter key, or value. Validation checks the finished graph, including connections that completion could not infer.

### `.midi(key, mapping)`

Maps an incoming MIDI Control Change to a rack parameter. Keys use `channel:cc` with a zero-based channel number. This example maps CC 74 on MIDI channel 1 to the cutoff of the `filter` instance. Completion offers valid instances and parameters.

```javascript
p.midi('0:74', { moduleId: 'filter', paramId: 'cutoff', min: 0, max: 1 })
```

To send notes out of a patch, add a `midi-out` module and connect pitch CV to its `pitch` input and a gate to `gate`. Select the destination port under **MIDI Setup → MIDI output**. [Send notes from the rack](midi.md#send-notes-from-the-rack)

## JavaScript and Dynamic Patches

Variables, functions, loops, template strings, arrays, and conditionals can generate a patch. Evaluation is synchronous; top-level `await` and module imports are not supported.

<!-- executable-patch -->
```javascript
const p = patch()

for (let voice = 1; voice <= 3; voice++) {
  p.module('vco', `osc${voice}`, { coarse: 0.27 + voice * 0.015 })
}

p.module('mix', 'mix1', { lvl1: 0.3, lvl2: 0.3, lvl3: 0.3 })
p.module('out', 'main', { volume: 0.6 })
p.connect('osc1.triangle', 'mix1.in1')
p.connect('osc2.triangle', 'mix1.in2')
p.connect('osc3.triangle', 'mix1.in3')
p.connect('mix1.out', 'main.L')
p.connect('mix1.out', 'main.R')
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
p.connect(bass.output, p.port(mixer, 'in2'))
p.connect(p.port(mixer, 'out'), p.port(main, 'L'))
p.connect(p.port(mixer, 'out'), p.port(main, 'R'))
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

**Apply** reuses the candidate from the last successful validation when its source and selected script are unchanged. Otherwise, it validates first. If the live rack has changed or the candidate has expired, select **Validate** again. Applying loads the candidate through `RackHost.loadPatch()` and, when audio is running, waits for AudioWorklet topology acknowledgement before rerendering. The host rolls back to the previous patch if activation fails. Apply does not start or stop audio.

**Snapshot** replaces the editor with consistently formatted code describing the current graphical rack. It emits one module declaration per line, rounds numeric values to five decimal places, preserves current instance names, and records placement, cables, MIDI mappings and non-default parameters, including declared structured state. Running audio buffers and sequencer play positions are not included. Manual rack changes remain valid; a drift warning means the rack no longer matches the last Apply or Snapshot. Loading a JavaScript file or reopening a named local script preserves its source whitespace.

## Console Commands

| Command | Result |
|---|---|
| `:help` | Command summary and documentation URLs |
| `:modules [filter]` | Registered module types, optionally filtered |
| `:describe <type-or-instance>` | Module UI contract; also parameters when the name identifies a live rack instance |
| `:rack` | Compact current rack state |
| `:json` | Pretty canonical v3 patch JSON |
| `:validate` | Validate the editor |
| `:apply` | Apply the validated editor patch; validate first if needed |
| `:snapshot` | Convert the graphical rack to source |
| `:profile start` | Enable and reset AudioWorklet timing samples |
| `:profile stop` | Stop collecting timing samples |
| `:profile report` | Show block/module p50, p95, and p99 timing |
| `:clear` | Clear the bounded diagnostic log |

Profiling requires running audio. Block p99 utilization compares the p99 processing time with the Web Audio render deadline; values approaching 100% indicate dropout risk.

## Scripts, Patches, and Sharing

In the **Patch** tab, named scripts autosave to this browser's local storage after editing. **New**, the name field, **Delete**, **Load**, and **Copy** operate on source; Copy writes it to the clipboard. **Save** immediately saves the selected script locally and attempts to apply it. Source is saved even if validation fails. Current Rack and Starter Voice are templates; editing either creates a local copy. Scripts are not synced to your account.

Scripts and patches remain separate:

- Applying a script creates an ordinary in-memory v3 patch.
- Rack **Save** and **Save a copy** store compiled patch state. **Copy snapshot link** captures the current rack; **Copy URL**, when available, links to a saved patch.
- Light and dark previews fit all rows of a large built-in rack into each image. If preview capture times out during a private account save, the rack still saves. When publishing, you can retry or choose **Save privately without preview**.
- Workbench Load reads JavaScript source into a new local script but never evaluates it automatically.
- Workbench Save (or Ctrl/Command+S) saves source locally, then applies the validated patch, validating first if needed.
- Neither snapshot links nor saved patch URLs include the JavaScript source.

## Troubleshooting

- **No sound:** start audio, include an `out` module, connect both desired output channels, and inspect warnings.
- **No socket suggestion:** declare the module literally or Validate once if it was generated dynamically.
- **Input unavailable:** another `.connect()` already targets it. Remove that connection or route through a mixer.
- **Unknown parameter/port:** use completion or `:describe`; panel labels are not always contract IDs.
- **Script timed out:** remove an infinite or excessively large loop. Evaluation stops after two seconds.
- **Action fires on Apply:** keep trigger and momentary parameters at `0` unless the side effect is intentional.
- **Rack drift:** Snapshot to capture graphical edits, or Validate then Apply to restore the script-defined graph.
- **High p99 utilization:** use `:profile start`, let the patch play, then `:profile report` to identify expensive modules and simplify the patch.

## Limitations

The workbench does not provide a general JavaScript language server, automatic evaluation while typing, per-port voltage probes, embedded source in patch URLs, asynchronous scripts, or Strudel-style cycle scheduling. Timing and modulation remain the job of rack modules such as CLK, SEQ, LFO, and function generators.
