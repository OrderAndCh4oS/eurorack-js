# Patch Workbench Guide

This tutorial builds, changes, diagnoses, and saves a patch entirely in the browser. Keep the [Patch Workbench Reference](patch-workbench.md) nearby for the complete API.

## 1. Open the Current Rack

Open the app and select **Code**. On the first open of a browser session, the editor is automatically populated from the current graphical rack. Choose **Starter Voice** only when you want the bundled minimal example. Press Ctrl/Command+Enter to apply without saving, or Ctrl/Command+S to create/save a local script and apply it. Select **Start** in the main toolbar if audio is stopped.

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

When the cursor is after `'osc.`, completion shows only VCO outputs. In the second connection argument it shows only compatible destination-direction sockets; completion is about direction and contracts, not a restriction on creative audio/CV cross-patching.

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

Validate and inspect the processing order. Sources are ordered before their destinations even if you arrange declarations differently.

## 4. Complete Switches, Buttons, and Toggles

Control values are numeric because that is the canonical module contract, but completion explains each state. For example, COMP `filterMode` offers `0 — Off`, `1 — HP`, and `2 — LP`; LOOP `mode` offers its declared button-bank values.

Place the cursor after each colon below and invoke completion:

<!-- executable-patch -->
```javascript
patch()
  .module('comp', 'compressor', {
    mode: 0,
    detector: 1,
    filterMode: 1,
    bypass: 0
  })
  .module('loop', 'looper', {
    reverse: 1,
    halfSpeed: 1,
    mode: 2,
    record: 0,
    clear: 0
  })
```

`record` is a toggle action. `clear` is a trigger action: `1` means it will fire when applied, so the workbench warns about it. Keep transient controls at `0` for ordinary saved patches.

## 5. Diagnose a Broken Patch

Introduce this misspelling temporarily:

```javascript
.connect('osc.saw', 'filter.input')
```

Validate. The rack keeps playing because validation is non-mutating. The log explains that `osc` has no `saw` output or `filter` has no `input` port. Use completion to repair the line as:

```javascript
.connect('osc.ramp', 'filter.audio')
```

The contract uses source-defined IDs, which can differ from familiar panel words. `:describe vco` and `:describe filter` show the exact contracts.

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
  p.module('lfo', `source${index}`, {
    rateKnob: 0.08 + index * 0.06,
    waveKnob: (index - 1) / 3
  })
}

p.module('mix', 'mixer')
  .connect('source1.primary', 'mixer.in1')
  .connect('source2.primary', 'mixer.in2')
  .connect('source3.primary', 'mixer.in3')
  .connect('source4.primary', 'mixer.in4')
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
  .connect(low.output, p.port(mix, 'in2'))
  .connect(p.port(mix, 'out'), p.port(main, 'L'))
  .connect(p.port(mix, 'out'), p.port(main, 'R'))
```

The unnamed system receives `vco_1` and `vcf_1`; the named system receives `bass_osc` and `bass_filter`. Calling `voice()` again continues the counters. Keeping repetition in ordinary JavaScript functions also lets a system own its internal wiring and expose only the socket IDs callers need.

## 9. Profile the Running Patch

Start audio, then enter:

```text
:profile start
```

Let the patch run for several seconds and enter:

```text
:profile report
```

The block line shows p50, p95, p99, and p99 utilization against the render deadline. Module lines are sorted by p99 time so expensive DSP is easy to find. Stop collecting with `:profile stop`. Profiling is opt-in and unavailable while audio is stopped.

## 10. Round-trip Graphical Edits

After applying a script, turn a knob, add a cable, or move a module in the graphical rack. The workbench reports that the rack differs from the last Apply. These edits remain live and valid.

Select **Snapshot** to replace the editor with deterministic source for the current rack. Snapshot includes exact rows and indexes, all cables, MIDI mappings, structured state, and every non-default knob, switch, button, or action. It asks before replacing non-empty source.

## 11. Save and Share Safely

- Script edits autosave into the selected local named script.
- **New**, rename, and **Delete** manage the local script bank.
- Workbench **Load** reads JavaScript source into a new script but does not evaluate it.
- Workbench **Save** persists source locally and applies it; Ctrl/Command+S does the same.
- Main-toolbar Save/Export/Share actions operate on the compiled v3 patch, not its source.

Always read imported code before Apply. The worker prevents page-freezing loops, but patch scripts are still trusted JavaScript running client-side.

## Complete Modulated Voice

This final example combines the tutorial steps and is ready to paste:

<!-- executable-patch -->
```javascript
const p = patch()

p.module('lfo', 'motion', {
  rateKnob: 0.16,
  waveKnob: 0.15,
  range: 0
})
  .module('vco', 'osc', {
    coarse: 0.29,
    fine: 0,
    glide: 5
  })
  .module('vcf', 'filter', {
    cutoff: 0.5,
    resonance: 0.42
  })
  .module('out', 'main', { volume: 0.62 })
  .connect('motion.primary', 'filter.cutoffCV')
  .connect('osc.ramp', 'filter.audio')
  .connect('filter.lpf', 'main.L')
  .connect('filter.lpf', 'main.R')
  .midi('0:74', {
    moduleId: 'filter',
    paramId: 'cutoff',
    min: 0,
    max: 1
  })
```

## Quick Troubleshooting

- Start audio and include a connected OUT module when you expect sound.
- Validate before Apply when exploring unfamiliar contracts.
- Use completion or `:describe`; never guess a port from its panel label.
- Remove a competing connection when an input is marked occupied.
- Keep trigger/momentary states at zero unless firing them is intentional.
- Validate dynamic scripts once to populate their generated completions.
- Use Snapshot when graphical edits are the version you want to keep.
- Use `:profile report` when audio crackles or approaches its deadline.
