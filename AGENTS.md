# Eurorack Emulator

Software Eurorack modular synthesizer. Modules pass voltages; sound only at output module.

## Voltage Standards

- **Audio**: ±5V | **Gates**: 0/10V | **Triggers**: 5-10ms pulse at 5-10V
- **Pitch CV**: 1V/octave (0V = base, +1V = +1 octave)
- **Thresholds**: Gates ≥1V, Clock >2.5V, Arp >0.4V, Pause >2V

## Architecture

```
index.html
└── js/app/app.js                 Browser bootstrap, DOM events, audio lifecycle
    ├── app/rack-state.js         Source of truth for modules, params, rows, cables
    ├── app/rack-host.js          Authoritative rack/plugin/audio lifecycle
    ├── app/patch-format.js       v3 validation and canonical v2 migration
    ├── audio/worklet-engine.js   Required AudioWorklet controller
    ├── audio/graph.js            Compiled routing and feedback delays
    ├── rack/module-manifest.js   Module imports, category taxonomy, default order
    ├── rack/core-definitions.js  Static core imports for the audio worklet
    ├── rack/registry.js          Atomic trusted-plugin registry
    ├── ui/renderer.js            Declarative/custom module UI rendering
    └── modules/{module}/index.js Self-contained DSP + UI definitions
```

**Self-contained modules**: Each module folder contains DSP + UI definition in one file. Modules export metadata, `createDSP()` factory, and declarative `ui` config.

**Available modules**: `midi-cv` (mono MIDI-CV) · `midi-4` (4-voice poly MIDI) · `midi-cc` (CC to CV) · `midi-clk` (MIDI clock) · `midi-drum` (drum pads to triggers) · `clk` (clock) · `div` (divider) · `swing` (swing clock) · `burst` (burst generator) · `lfo` · `quad-lfo` (quadrature LFO) · `nse` (noise) · `wavetable` (wavetable oscillator) · `sh` (sample&hold) · `quant` (quantizer) · `arp` (arpeggiator) · `seq` (sequencer) · `seq-switch` (sequential switch) · `euclid` (euclidean rhythm) · `logic` (AND/OR gates) · `mult` (signal splitter) · `matrix` (matrix mixer) · `joystick` (XY controller) · `vco` · `pluck` (plucked string voice) · `vcf` · `lpg` (low pass gate) · `formant` (formant filter) · `fold` (wavefolder) · `ring` (ring mod) · `rnd` (random) · `envf` (envelope follower) · `func` (function generator) · `adsr` · `vca` · `atten` (attenuverter) · `slew` · `mix` · `dly` (delay) · `tape` (tape delay) · `verb` (reverb) · `chorus` · `phaser` · `flanger` · `crush` (bit crusher) · `loop` (minimal looper) · `granulita` (granular chord) · `db` (VU meter) · `pwm` (pulse width mod) · `turing` (random looping seq) · `ochd` (8x LFO) · `cmp2` (window comparator) · `comp` (compressor/limiter) · `kick` · `snare` · `hat` · `scope` · `spectrum` (FFT analyzer) · `plot` (waveform plotter) · `spectrogram` (freq over time) · `rec` (WAV recorder) · `out`

## Project Structure

```
src/js/
├── index.js               # Public exports
├── app/                   # Browser app state/controllers
│   ├── app.js             # App bootstrap and event orchestration
│   ├── rack-state.js      # Modules, rows, params, cables, patch state
│   ├── rack-host.js       # Runtime ownership and worklet synchronization
│   └── patch-format.js    # v3 validation and v2 migration
├── rack/                  # Rack infrastructure
│   ├── module-manifest.js # Module imports, order, category taxonomy
│   ├── core-definitions.js # Static worklet imports matching manifest order
│   ├── module-contract.js # Module/port contract validation
│   └── registry.js        # Plugin and module registration
├── ui/
│   ├── renderer.js        # Declarative UI → DOM
│   └── toolkit/           # UI component factories
│       ├── components.js  # Knobs, jacks, switches, LEDs
│       ├── layout.js      # Panels, rows, sections
│       └── interactions.js # Drag handling
├── modules/               # Self-contained modules
│   └── {moduleId}/
│       └── index.js       # DSP + UI definition
├── audio/
│   ├── graph.js           # Compiled routing graph
│   ├── worklet-engine.js  # Main-thread worklet controller
│   └── worklet/           # Audio-thread processor/plugin registry
├── config/
│   ├── factory-patches.js # Aggregate factory patch export
│   └── patches/           # Factory patch definitions
└── patches/               # Patch serialization

tests/dsp/{module}.test.js # Module tests
```

## Module Processing Order

Production processing order is compiled in the AudioWorklet by `compileGraph()`:
- Sources process before destinations using a topological sort of strongly connected components
- Ties are broken by module manifest order, rack order, then instance ID
- Every edge inside a feedback component uses an explicit one-block delay, including self-feedback
- Inputs accept one source; a new UI cable replaces the occupied input, while output fan-out remains legal
- Imported duplicate destinations reject the patch instead of being silently rewritten
- Topology revisions activate atomically after worklet acknowledgement

`src/js/audio/engine.js` is a main-thread reference/test engine, not the production browser audio path.

## Researching a Module

Before writing DSP or UI, create or update `research/modules/{moduleId}.md`. Do not rely on memory or a single product listing.

1. Find primary sources first: official manufacturer page, manual/PDF, firmware/source code when available, official calibration or hidden-mode notes, product announcements, press releases, and archived product pages.
2. Add varied historical/context sources where useful: old synth magazines, zines, catalogs, interviews, mailing-list posts, forum threads, trade-show coverage, patents, academic papers, and app notes.
3. Review demos and reviews: manufacturer demos, independent video demos, written reviews, forum sound examples, and comparison shootouts. Capture observed sonic behavior, interaction details, quirks, and any settings shown.
4. Cross-check practical secondary sources: ModularGrid for HP/specs/panel layout, retailer pages for concise feature lists, user manuals for adjacent revisions, and trusted reviews for observed behavior.
5. Document the full panel contract: knobs, switches, buttons, audio inputs, CV inputs, gate/trigger inputs, outputs, LEDs, normalization behavior, and any mode combinations.
6. Capture exact electrical behavior where known: audio ranges, CV ranges and scaling, gate/trigger thresholds, pulse lengths, pitch tracking, clipping/saturation, reset behavior, and calibration tolerances.
7. Track source quality and contradictions. Prefer primary specs for electrical facts, but keep contradictory reports in the research doc with notes on which source wins and why.
8. Translate hardware behavior into this app's voltage standards. If the hardware spec is unknown, state the assumption and choose a musically useful range consistent with adjacent modules.
9. Decide the DSP model before coding: faithful hardware emulation, inspired-by approximation, or utility adaptation. Document trade-offs, CPU implications, and expected audible differences.
10. Record implementation references: papers, open-source DSP, MusicDSP/KVR discussions, manufacturer code, or comparable modules already in this repo.
11. Define test targets from the research: output ranges, parameter extremes, CV scaling, trigger thresholds, state reset, LED behavior, and any manufacturer-specific behavior.
12. Keep all sources linked in the research doc. Include title, author/publisher when known, date or approximate era, URL/archive URL, access date for unstable pages, and a one-line note on what the source supports.
13. Cite the research in code comments only where it explains a non-obvious DSP choice.

## Processing the Module Queue

Use `research/module-queue.md` as the candidate board. Queue statuses are `candidate`, `researching`, `spec-ready`, `implementing`, `blocked`, and `done`.

When asked to process a queued module end to end, follow the copy-paste command in `docs/codex-process-module-command.md`.

Do not implement a queued module until it is `spec-ready`. Spec-ready means the research doc has citations, panel contract, voltage contract, DSP plan, assumptions/contradictions, and test targets.

For parallel module development, isolate each module in its own branch or worktree:

```bash
git worktree add ../eurorack-js-{moduleId} -b module/{moduleId}
```

Use `research/{moduleId}` for research-only branches and `module/{moduleId}` for implementation branches. Keep shared framework changes separate from module implementation branches unless they are explicitly planned.

Before coding, add an `Implementation Plan` section to `research/modules/{moduleId}.md` covering module ID, category, branch/worktree, DSP model, params, inputs, outputs, LEDs, factory patch needs, focused tests, full validation command, and known assumptions.

## Writing Tests (BEFORE implementation)

Tests go in `tests/dsp/{module}.test.js`. Test these categories:

1. **Initialization** — default params, buffers created, correct sizes
2. **Output ranges** — audio ±5V, gates 0/10V
3. **Each knob** — min/max behavior, effect on output
4. **Each CV input** — modulation response, voltage scaling
5. **Each trigger input** — edge detection, correct threshold
6. **Each switch/mode** — behavior in each position
7. **LEDs** — reflect module state
8. **Reset** — clears all internal state
9. **Buffer integrity** — no NaN, fills entire buffer
10. **Spec compliance** — matches manufacturer documentation

## Self-Contained Module Structure

```javascript
// src/js/modules/{moduleId}/index.js
export default {
    // Metadata
    id: 'moduleId',
    name: 'Module Name',
    hp: 4,                    // Panel width
    color: 'module-color-six', // Theme color token
    category: 'source',       // Sidebar category; must be in CATEGORY_ORDER

    // DSP factory
    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        return {
            params: { knob: 0.5, switch: 0 },
            inputs: { cv: new Float32Array(bufferSize) },
            outputs: { out },
            leds: { active: 0 },
            process() { /* fill outputs */ },
            reset() { /* clear state */ }
        };
    },

    // Declarative UI
    ui: {
        leds: ['active'],
        knobs: [{ id: 'knob', label: 'Knob', param: 'knob', min: 0, max: 1, default: 0.5 }],
        switches: [{ id: 'switch', label: 'Mode', param: 'switch', default: 0 }],
        inputs: [{ id: 'cv', label: 'CV', port: 'cv', signal: 'cv' }],
        outputs: [{ id: 'out', label: 'Out', port: 'out', signal: 'audio' }]
    }
};
```

Custom-rendered modules must also declare bounded worklet telemetry, even when they only use params and LEDs:

```javascript
telemetry: {
    fields: ['displayBuffer'],
    methods: ['getStats'],
    history: { field: 'history', maxEntries: 300 }
}
```

The main-thread UI mirror is stable across audio start/stop. It is not the production DSP instance. Custom controls must call `onParamChange`; direct mirror mutation does not control audio. Browser-only work initiated by DSP must cross the `drainEvents()` / `handleWorkletEvent()` module-event boundary.

**Port signals**: `audio` | `cv` | `gate` | `trigger` | `any`. Inputs may declare `voltage: { min, max, normal }`.

**Module categories**: Module definitions own their own sidebar category. Use one of `midi`, `clock`, `source`, `voice`, `modulation`, `sequencer`, `quantizer`, `filter`, `effect`, `utility`, `output`, or `other` from `CATEGORY_ORDER` in `src/js/rack/module-manifest.js`.

**Module colors**: Built-in modules should use one of the shared theme tokens in the `color` field: `module-color-one` through `module-color-twelve`. Themes map those tokens to their own light/dark palettes; six-digit hex colors are only a custom-module compatibility fallback.

## Registering a New Module

After creating `src/js/modules/{moduleId}/index.js`, register it in the manifest:

```javascript
// src/js/rack/module-manifest.js
{ id: '{moduleId}', load: () => import('../modules/{moduleId}/index.js') },
```

Also add a static import to `src/js/rack/core-definitions.js` and append the definition in the same position as `MODULE_MANIFEST`. The manifest controls main-thread lazy imports and default processing-order tie breaks; the static list builds the worklet bundle. Contract tests require their IDs and order to match.

External trusted modules use `registerPlugin(manifest)` instead of editing core lists. A plugin provides `id`, `name`, package `version`, `apiVersion`, `patchVersion`, `workletUrl`, and `modules`. Its worklet file must call `globalThis.registerEurorackWorkletPlugin()` with matching ownership and patch versions. See `docs/architecture.md` and `docs/creating-modules.md`.

Update documentation:
- Add to `AGENTS.md` available modules list
- Add to `README.md` module table
- Add or update `docs/creating-modules.md` if the module introduces a new pattern

Create a focused DSP test in `tests/dsp/{moduleId}.test.js` and, when useful, a test patch in `src/js/config/patches/test-{moduleId}.js`.

Validation for a new module:
- Run `npm test -- tests/dsp/{moduleId}.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- If factory patches changed, run `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`
- Before merge, run `npm test`

## Common DSP Patterns

**Edge detection:**
```javascript
const rising = trig[i] >= 1 && lastTrig < 1;
lastTrig = trig[i];  // Update AFTER check
```

**V/Oct to frequency:**
```javascript
freq = baseFreq * Math.pow(2, vOct) * Math.pow(2, fine / 12);
```

**Slew limiting:** Use `createSlew()` from `src/js/utils/slew.js`

**PolyBLEP:** Apply at saw/pulse discontinuities for anti-aliasing

**Stable inputs and disconnection:** DSP input `Float32Array` identities never change. The compiled graph writes routed samples into them and restores each input's declared normal voltage on disconnection. Modules must not replace input arrays or implement cable cleanup methods.

**Worklet restrictions:** `createDSP()` and `process()` cannot depend on `window`, `document`, DOM events, or main-thread Web Audio nodes. Use injected `services` for MIDI. Use bounded telemetry for displays and module events for infrequent transferable data such as completed recordings.

## Writing Patches

Patches are stored in `src/js/config/patches/`. Each patch file exports:

```javascript
export default {
    name: 'Patch Name',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            // id = your chosen name for this instance
            // type = module id from the module definition
            { id: 'lfo1', type: 'lfo', row: 1, index: 0 },
            { id: 'lfo2', type: 'lfo', row: 1, index: 1 },
            { id: 'vco1', type: 'vco', row: 1, index: 2 }
        ],
        params: {
            // Keys match module instance ids
            lfo1: { rateKnob: 0.5 },
            lfo2: { rateKnob: 0.2 },
            vco1: { coarse: 0.35, fine: 0 }
        },
        cables: [
            // fromModule/toModule = module instance id
            // fromPort/toPort = port name from module definition
            { fromModule: 'lfo1', fromPort: 'primary', toModule: 'vco1', toPort: 'vOct' }
        ],
        midiMappings: {}
    }
};
```

**Key distinctions:**
- `type` = Module id (from module's `id` field, e.g., `'lfo'`, `'vco'`)
- `id` = Your name for this instance (used in `params` and `cables`)
- `fromPort`/`toPort` = Port name from module's `ui.inputs[]` or `ui.outputs[]`
- Canonical v2 patches receive a one-time v3 migration. Legacy shapes using `instanceId`, `knobs`, `switches`, or `buttons` are rejected; new patches must use version 3 and declare `plugins`.

**IMPORTANT**: Cable port names must match the `port` field in each module's `ui.inputs[]` and `ui.outputs[]`. Always check the module's index.js for exact port names.

Each input may appear at most once in `cables`. Output fan-out is represented by repeating a source endpoint across cables. Use a mixer or logic module for fan-in rather than declaring multiple cables to one input.

### Module Port Reference

Port names are source-defined in each module's `ui.inputs[]` and `ui.outputs[]`. Do not rely on a copied table when writing patches; inspect `src/js/modules/{moduleId}/index.js` and use the exact `port` values. Contract tests validate factory patch cables against these module definitions.

### Adding a New Patch

1. Create file: `src/js/config/patches/{name}.js`
2. Import in `src/js/config/patches/index.js`
3. Add to `FACTORY_PATCHES` export
4. Run focused tests: `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`

## Updating Patches

When module specs change (renamed/removed params, inputs, outputs, switches):
1. Search: `rg "moduleName|paramName|portName" src/js/config/patches tests`
2. Update all `params` and `cables` references
3. Add migration support in `src/js/app/patch-format.js` if persisted legacy/user patches need compatibility

## Troubleshooting

- **NaN** — Guard division by zero, clamp inputs, test with `.every(v => !isNaN(v))`
- **Clicks** — Use slew for params, ensure envelopes end at zero, apply PolyBLEP
- **DC offset** — Test mean ≈ 0 for audio outputs
- **Trigger not firing** — Check threshold, ensure lastTrig updated AFTER edge check
- **CV delayed** — Inspect the compiled worklet topology and feedback components; feedback routes intentionally add one block
- **Custom UI blank/stale** — Ensure the module declares every required telemetry field/method and reads the stable UI mirror
- **Browser API error in DSP** — Move DOM/file work to `handleWorkletEvent()` and emit it from worklet `drainEvents()`
- **Patch rejected** — Check v3 plugin dependencies, module ownership, exact endpoint directions, and duplicate input destinations

## Checklist

- [ ] All knobs with correct ranges
- [ ] All CV inputs with proper voltage scaling
- [ ] All audio/gate/trigger inputs
- [ ] All outputs producing correct voltage ranges
- [ ] All switches/modes
- [ ] LED indicators reflect state
- [ ] Matches manufacturer manual
- [ ] Tests passing
- [ ] Factory patches updated if specs changed

## Links

- [Runtime Architecture and Schemas](docs/architecture.md) — Thread ownership, plugin contracts, routing, telemetry, and patch v3
- [Creating Modules](docs/creating-modules.md) — Built-in and trusted-plugin authoring guide

- [ModularGrid](https://modulargrid.net) — Module database
- [2hp](https://www.twohp.com/modules) — Official manuals
- [Mutable Instruments GitHub](https://github.com/pichenettes/eurorack) — Open source DSP

## Research

Module documentation and DSP references are maintained in `/research/`:
- `research/module-queue.md` — Candidate backlog for new modules; queued items still need cited research before implementation
- `research/modules/` — Per-module specs, manuals, and implementation references
- `research/topics/` — Cross-cutting DSP topics (filters, anti-aliasing, etc.)
- `research/sound-engineering-review.md` — Sound quality improvements and recommendations

When implementing or modifying modules, consult and update the relevant research docs to maintain a trail of source material.

## Sound Engineering Philosophy

We balance hardware authenticity with optimal sound quality. When making DSP decisions:

1. **Document the options** — Record what approaches exist (e.g., linear vs allpass interpolation)
2. **Explain the trade-offs** — Note CPU cost, sound quality, complexity
3. **Reference the research** — Link to papers, code, or forum discussions that informed the choice
4. **Make the decision visible** — Comment in code why a particular approach was chosen

Before implementing improvements, check `research/sound-engineering-review.md` for prioritized recommendations. After implementing, update the review document with results and any new findings.

### Quality Priorities
1. **No audible artifacts** — Eliminate aliasing, clicks, zipper noise
2. **Musical parameter ranges** — Knobs should feel useful across their full range
3. **Analog character** — Capture warmth, nonlinearity, and behavior of hardware
4. **Modulation response** — CV inputs should respond musically at audio rates
5. **CPU efficiency** — Good enough quality at acceptable performance cost
