# Patch Workbench Guide

This tutorial builds, changes, diagnoses, and saves a patch entirely in the browser. Keep the [Patch Workbench Reference](patch-workbench.md) nearby for the complete API.

## 1. Open the Current Rack

Open the app and select **Code**, then the **Patch** tab. The first time you open it after loading the app, the patch editor is populated from the current graphical rack. Choose **Starter Voice** for the bundled minimal example. Press Ctrl/Command+Enter to apply, or Ctrl/Command+S to immediately save the source locally and apply it. Neither action saves a patch to your account. Select **Start** in the main toolbar if audio is stopped.

The **Modules** tab lets you read built-in source and develop your own browser-local modules. It is separate from the patch editor; see [Work with module source](#12-work-with-module-source).

The starter is a VCO connected to both output channels:

<!-- executable-patch -->
```javascript
patch()
  .module('vco', 'osc', { coarse: 0.3 })
  .module('out', 'main', { volume: 0.65 })
  .connect('osc.triangle', 'main.L')
  .connect('osc.triangle', 'main.R')
```

Editing the read-only starter creates a named local copy automatically.

Module type always comes first. The name is optional: `.module('vco')` creates `vco_1`, while `.module('vco', 'osc', { coarse: 0.3 })` gives it the stable name `osc`. Generated snapshots use the named form so connections round-trip exactly.

## 2. Use Completion to Add a Filter

Add a module call before `main`. Inside the first quoted argument type `vc` and press Ctrl/Command+Space. Choose `vcf`, then optionally add the name `filter`. In the parameter object, completion offers `cutoff` and `resonance` with their ranges and defaults.

Change the oscillator connections to the following graph:

<!-- executable-patch -->
```javascript
patch()
  .module('vco', 'osc', { coarse: 0.3 })
  .module('vcf', 'filter', { cutoff: 0.52, resonance: 0.35 })
  .module('out', 'main', { volume: 0.65 })
  .connect('osc.ramp', 'filter.audio')
  .connect('filter.lpf', 'main.L')
  .connect('filter.lpf', 'main.R')
```

When the cursor is after `'osc.`, completion lists matching VCO outputs. In the second connection argument it lists inputs. It does not filter by signal type, so audio/CV cross-patching is allowed.

Tab completion replaces the whole current token. If the caret is in the middle of an existing socket, parameter name, or value, the text on both sides of the caret is replaced rather than leaving a stale suffix.

Press Ctrl/Command+Shift+Enter to Validate without changing the rack. The log should show three modules, three cables, and the processing order `osc → filter → main`. Apply when ready.

## 3. Add Modulation

Add an LFO and connect its primary CV output to the filter cutoff input:

<!-- executable-patch -->
```javascript
patch()
  .module('lfo', 'motion', { rateKnob: 0.18, waveKnob: 0, range: 0 })
  .module('vco', 'osc', { coarse: 0.3 })
  .module('vcf', 'filter', { cutoff: 0.48, resonance: 0.38 })
  .module('out', 'main', { volume: 0.65 })
  .connect('motion.primary', 'filter.cutoffCV')
  .connect('osc.ramp', 'filter.audio')
  .connect('filter.lpf', 'main.L')
  .connect('filter.lpf', 'main.R')
```

Validate and inspect the processing order. In this graph, sources are ordered before their destinations even if you arrange declarations differently. Feedback loops are also allowed; connections inside a feedback loop use a one-block delay.

## 4. Complete Switches, Buttons, and Toggles

Control values are numeric because that is the canonical module contract, but completion explains each state. For example, COMP `filterMode` offers `0 — Off`, `1 — HP`, and `2 — LP`; LOOP `mode` offers its declared button-bank values.

Place the cursor after each colon below and invoke completion:

<!-- executable-patch -->
```javascript
patch()
  .module('comp', 'compressor', { mode: 0, detector: 1, filterMode: 1, bypass: 0 })
  .module('loop', 'looper', { reverse: 1, halfSpeed: 1, mode: 2, record: 0, clear: 0 })
```

`record` is a toggle action. `clear` is a trigger action: `1` requests the action when audio processes the loaded patch, so the workbench warns about it. Keep transient controls at `0` for ordinary saved patches.

## 5. Diagnose a Broken Patch

Introduce this misspelling temporarily:

```javascript
.connect('osc.saw', 'filter.input')
```

Validate. The rack keeps playing because validation is non-mutating. The log explains that `osc` has no `saw` output or `filter` has no `input` port. Use completion to repair the line as:

```javascript
.connect('osc.ramp', 'filter.audio')
```

The contract uses source-defined IDs, which can differ from familiar panel words. Enter `:describe vco` or `:describe vcf` in the command input below the log to see those module contracts. You can also use an instance name such as `filter` once that instance is in the live rack; the command does not inspect unapplied editor declarations.

## 6. Understand Fan-out and Occupied Inputs

Sending one output to both stereo inputs is legal fan-out:

```javascript
.connect('filter.lpf', 'main.L')
.connect('filter.lpf', 'main.R')
```

Sending two outputs to the same input is rejected:

```javascript
.connect('osc.ramp', 'filter.audio')
.connect('noise.white', 'filter.audio')
```

Destination completion marks `filter.audio` unavailable after the first connection. Use MIX or another appropriate utility when you need fan-in.

## 7. Generate Repeated Modules

Ordinary JavaScript can remove repetition:

<!-- executable-patch -->
```javascript
const p = patch()

for (let index = 1; index <= 4; index++) {
  p.module('lfo', `source${index}`, { rateKnob: 0.08 + index * 0.06, waveKnob: (index - 1) / 3 })
}

p.module('mix', 'mixer')
p.connect('source1.primary', 'mixer.in1')
p.connect('source2.primary', 'mixer.in2')
p.connect('source3.primary', 'mixer.in3')
p.connect('source4.primary', 'mixer.in4')
```

The tolerant editor scan cannot know loop results before execution. Validate once; `source1` through `source4` then appear as validated completion entries.

## 8. Build Reusable Voices

Use `add()` when a module may repeat. It returns an automatically incremented name; pass `{ name }` when a stable human-readable name is useful. Package combinations in ordinary functions and return their exposed endpoints:

<!-- executable-patch -->
```javascript
function voice(p, { name = null, coarse = 0.3 } = {}) {
  const named = suffix => name ? { name: `${name}_${suffix}` } : {}
  const osc = p.add('vco', { coarse }, named('osc'))
  const filter = p.add('vcf', { cutoff: 0.52 }, named('filter'))
  p.connect(p.port(osc, 'ramp'), p.port(filter, 'audio'))
  return { output: p.port(filter, 'lpf'), pitch: p.port(osc, 'vOct') }
}

const p = patch()
const high = voice(p, { coarse: 0.34 })
const low = voice(p, { name: 'bass', coarse: 0.22 })
const mix = p.add('mix')
const main = p.add('out')

p.connect(high.output, p.port(mix, 'in1'))
p.connect(low.output, p.port(mix, 'in2'))
p.connect(p.port(mix, 'out'), p.port(main, 'L'))
p.connect(p.port(mix, 'out'), p.port(main, 'R'))
```

The unnamed system receives `vco_1` and `vcf_1`; the named system receives `bass_osc` and `bass_filter`. Calling `voice()` again continues the counters. Keeping repetition in ordinary JavaScript functions also lets a system own its internal wiring and expose only the socket IDs callers need.

## 9. Profile the Running Patch

Start audio, then enter this in the command input below the log:

```text
:profile start
```

Let the patch run for several seconds and enter:

```text
:profile report
```

The block line shows p50, p95, p99, and p99 utilization against the render deadline. Module lines are sorted by p99 time so expensive DSP is easy to find. Stop collecting with `:profile stop`. Profiling is opt-in and unavailable while audio is stopped.

## 10. Convert Rack Edits to Code

After applying a script, turn a knob, add a cable, or move a module in the graphical rack. The workbench reports that the rack differs from the last Apply. These edits remain live and valid.

Select **Snapshot** to replace the editor with source for the current rack. Snapshot emits one module call per line and includes module placement, cables, MIDI mappings and non-default parameters, including declared structured state. Numbers are rounded to five decimal places. It captures patch settings, not running audio buffers or sequencer play positions. It asks before replacing non-empty source that differs from the snapshot.

## 11. Save and Share

- Script edits autosave into the selected local named script.
- **New**, rename, and **Delete** manage the local script bank.
- Workbench **Load** reads JavaScript source into a new script but does not evaluate it.
- Workbench **Save** persists source locally and applies it; Ctrl/Command+S does the same.
- The rack's **Save** and **Save a copy** controls save the compiled patch. **Copy snapshot link** captures its current settings; **Copy URL**, when available, links to the saved patch. None of these include the JavaScript source.
- **Guide** and **Reference** open these documentation pages.

Read loaded patch code before Apply. Patch scripts run in a disposable worker with network, page and app-storage access blocked. Applying a script changes the rack; saving that patch to your account is a separate action. This isolation does not apply to module DSP code.

## 12. Work with Module Source

Open **Code → Modules**. **Your modules** appears before **Built-in modules**, and search covers both lists. Selecting a built-in shows its exact source, read-only. Source loads when selected and is reused on later selections in the same session. **Copy code** and **View on GitHub** are available beside it.

To develop your own module:

1. Read [Creating Modules](creating-modules.md) for the DSP, panel and voltage contracts.
2. Choose **New module** for a starter definition, or **Import own module** to load your own `.js` or `.mjs` file as a draft. Importing does not run it.
3. Edit a self-contained ES module with a default-exported definition. Local module source cannot use import declarations, dynamic imports or re-exports. Built-in source may import shared helpers; a local draft must include the helpers it needs.
4. Choose **Save** to store the draft in this browser without executing it. Ctrl/Command+S does the same while the module editor has focus.
5. Choose **Use module** to save and run the definition, then add it to the rack. Connect and test it as you would any other module.

Module code runs as trusted JavaScript in this browser, outside the patch-script sandbox. The import restrictions are an authoring constraint, not a security sandbox. Use this editor for your own reviewed code.

Using a module retains an immutable executable revision with an ID such as `local-<lowercase ULID>`. Later edits become a separate revision when used; they do not change modules in older patches. Drafts and revisions stay in this browser's local storage. Opening a browser-saved patch loads its required revisions from that storage; merely browsing the module list does not run drafts.

Local module code is not synced to your account or included in a snapshot link. A patch that uses it cannot be saved to an account or published, and another browser does not have its dependencies. Keep a copy of your source outside browser storage. To make a module available to everyone, follow the [GitHub contribution workflow](creating-modules.md#contribute-a-module).

## Complete Modulated Voice

This final example combines the tutorial steps and is ready to paste:

<!-- executable-patch -->
```javascript
const p = patch()

p.module('lfo', 'motion', { rateKnob: 0.16, waveKnob: 0.15, range: 0 })
p.module('vco', 'osc', { coarse: 0.29, fine: 0, glide: 5 })
p.module('vcf', 'filter', { cutoff: 0.5, resonance: 0.42 })
p.module('out', 'main', { volume: 0.62 })
p.connect('motion.primary', 'filter.cutoffCV')
p.connect('osc.ramp', 'filter.audio')
p.connect('filter.lpf', 'main.L')
p.connect('filter.lpf', 'main.R')
p.midi('0:74', { moduleId: 'filter', paramId: 'cutoff', min: 0, max: 1 })
```

## Quick Troubleshooting

- Start audio and include a connected OUT module when you expect sound.
- Validate before Apply when exploring unfamiliar contracts.
- Use completion or `:describe`; never guess a port from its panel label.
- Remove a competing connection when an input is marked occupied.
- Keep trigger/momentary states at zero unless firing them is intentional.
- Validate dynamic scripts once to populate their generated completions.
- Use Snapshot when graphical edits are the version you want to keep.
- Use `:profile start`, let the patch play, then `:profile report` to investigate audio crackles or high processing time.
