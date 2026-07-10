# Creating Modules

This guide takes a module from research through DSP, UI, registration, patches, and tests. It covers built-in modules and trusted plugins. Read [Codebase Architecture and Schemas](architecture.md) first for thread ownership and routing.

## Contract at a Glance

A definition is instantiated twice:

- The main thread creates a stable UI mirror.
- The AudioWorklet creates the production DSP instance.

The **ui** declaration is the public schema. Every DSP-facing parameter and port must be declared there. Unknown parameters, missing module IDs, non-object parameter groups, non-finite values, invalid ports, and plugin contract mismatches are rejected.

Core rules:

1. Allocate input and output Float32Array buffers once in createDSP().
2. Keep buffer identities stable for the DSP lifetime.
3. Fill every output sample during every process() call.
4. Match declared voltage ranges and input normals.
5. Keep UI defaults and DSP defaults identical.
6. Keep DSP worklet-safe: no DOM, downloads, browser globals, or main-thread audio nodes.
7. Reset all internal state, buffers, helper state, and LEDs deterministically.
8. Use bounded telemetry for displays and module events for infrequent command results.

## Research Before Implementation

Before creating or modifying a hardware-inspired module, create or update **research/modules/{moduleId}.md**. Do not implement a queue candidate until it is **spec-ready**.

Research should include:

1. Primary sources: manufacturer page, manual, firmware/source, calibration notes, announcements, and archived official pages.
2. Historical context where useful: magazines, catalogs, interviews, mailing lists, forum threads, patents, papers, and application notes.
3. Demos and reviews: observed sound, interaction details, quirks, settings, and patch context.
4. Practical secondary sources: ModularGrid, retailer specifications, trusted reviews, and relevant user reports.
5. Complete panel contract: every control, jack, LED, normalization, mode, and alternate function.
6. Electrical contract: audio/CV ranges, thresholds, pulse lengths, pitch tracking, clipping, reset behavior, and calibration tolerance.
7. Source conflicts: what disagrees, which source wins, and why.
8. DSP decision: faithful emulation, inspired approximation, or utility adaptation, including CPU and sound-quality trade-offs.
9. Test targets: initialization, ranges, controls, CV, triggers, modes, LEDs, reset, buffer integrity, and documented hardware behavior.

If a detail is unknown, document the assumption and choose a musically useful behavior consistent with this application's voltage standards.

Every source entry should include title, author or publisher when known, date or approximate era, URL or archive URL, access date for unstable pages, and a short note explaining what it supports.

## Queue and Worktree Workflow

Use **research/module-queue.md** as the candidate board. Statuses are **candidate**, **researching**, **spec-ready**, **implementing**, **blocked**, and **done**.

For the repository's end-to-end queued-module workflow, use the copy-paste request in [codex-process-module-command.md](codex-process-module-command.md).

For parallel work, isolate each module:

~~~bash
git worktree add ../eurorack-js-{moduleId} -b module/{moduleId}
~~~

Use **research/{moduleId}** for research-only branches and **module/{moduleId}** for implementation branches. Keep shared framework changes separate unless the implementation plan explicitly includes them.

Before coding, add:

~~~markdown
## Implementation Plan
- Module ID:
- Category:
- Branch/worktree:
- DSP model:
- Params:
- Inputs:
- Outputs:
- LEDs:
- Factory patch:
- Focused tests:
- Full validation command:
- Known assumptions:
~~~

Write **tests/dsp/{moduleId}.test.js** before implementation. Minimum focused validation:

~~~bash
npm test -- tests/dsp/{moduleId}.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js
~~~

When factory patches change:

~~~bash
npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js
~~~

Before merge:

~~~bash
npm test
~~~

## Tutorial 1: Basic LFO

This sine LFO demonstrates metadata, sample-rate-aware state, a finite parameter, a +/-5V output, LED state, stable buffers, and reset.

Create **src/js/modules/basic-lfo/index.js**:

~~~javascript
export default {
    id: 'basic-lfo',
    name: 'Basic LFO',
    hp: 4,
    color: 'module-color-six',
    category: 'modulation',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const sine = new Float32Array(bufferSize);
        let phase = 0;

        return {
            params: { rate: 1 },
            inputs: {},
            outputs: { sine },
            leds: { phase: 0.5 },

            process() {
                const rate = Math.max(0.05, Math.min(20, this.params.rate));
                for (let i = 0; i < bufferSize; i++) {
                    sine[i] = Math.sin(phase * Math.PI * 2) * 5;
                    phase += rate / sampleRate;
                    phase -= Math.floor(phase);
                }
                this.leds.phase = sine[bufferSize - 1] / 10 + 0.5;
            },

            reset() {
                phase = 0;
                sine.fill(0);
                this.leds.phase = 0.5;
            }
        };
    },

    ui: {
        leds: ['phase'],
        knobs: [
            { id: 'rate', label: 'Rate', param: 'rate', min: 0.05, max: 20, default: 1 }
        ],
        outputs: [{
            id: 'sine',
            label: 'Sine',
            port: 'sine',
            signal: 'cv',
            voltage: { min: -5, max: 5 }
        }]
    }
};
~~~

Why it is structured this way:

- Phase belongs to the DSP instance, not global module state.
- rate / sampleRate makes frequency independent of sample rate.
- Subtracting Math.floor(phase) keeps phase bounded over long sessions.
- The stable output buffer is filled in place on every block.
- DSP and UI both default rate to 1.
- Output voltage and LED values stay inside declared ranges.

### LFO Tests

Create **tests/dsp/basic-lfo.test.js**:

~~~javascript
import { describe, expect, it } from 'vitest';
import basicLfo from '../../src/js/modules/basic-lfo/index.js';

describe('basic-lfo', () => {
    it('produces finite bipolar 5V output without replacing its buffer', () => {
        const lfo = basicLfo.createDSP({ sampleRate: 48000, bufferSize: 128 });
        const output = lfo.outputs.sine;

        lfo.process();

        expect(lfo.outputs.sine).toBe(output);
        expect(output.every(Number.isFinite)).toBe(true);
        expect(Math.max(...output)).toBeLessThanOrEqual(5);
        expect(Math.min(...output)).toBeGreaterThanOrEqual(-5);
        expect(lfo.leds.phase).toBeGreaterThanOrEqual(0);
        expect(lfo.leds.phase).toBeLessThanOrEqual(1);
    });

    it('resets state and observable output', () => {
        const lfo = basicLfo.createDSP({ bufferSize: 128 });
        lfo.process();
        lfo.reset();

        expect(lfo.outputs.sine.every(sample => sample === 0)).toBe(true);
        expect(lfo.leds.phase).toBe(0.5);
    });
});
~~~

Also test rate extremes and verify that changing rate changes the measured period.

## Tutorial 2: Simple VCA

The VCA adds stable inputs, a non-zero input normal, CV smoothing, finite guards, output limiting, and complete helper-state reset.

Create **src/js/modules/simple-vca/index.js**:

~~~javascript
import { clamp } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';

export default {
    id: 'simple-vca',
    name: 'Simple VCA',
    hp: 4,
    color: 'module-color-eleven',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const audio = new Float32Array(bufferSize);
        const cv = new Float32Array(bufferSize).fill(5);
        const out = new Float32Array(bufferSize);
        const cvSlew = createSlew({ sampleRate, timeMs: 5 });
        cvSlew.reset(5);

        return {
            params: { gain: 0.8 },
            inputs: { audio, cv },
            outputs: { out },
            leds: { level: 0 },

            process() {
                const gain = clamp(this.params.gain, 0, 1);
                let peak = 0;

                for (let i = 0; i < bufferSize; i++) {
                    const input = Number.isFinite(this.inputs.audio[i]) ? this.inputs.audio[i] : 0;
                    const cvInput = Number.isFinite(this.inputs.cv[i]) ? this.inputs.cv[i] : 0;
                    const cvGain = clamp(cvSlew.process(cvInput) / 5, 0, 1);
                    const sample = clamp(input * gain * cvGain, -5, 5);

                    out[i] = sample;
                    peak = Math.max(peak, Math.abs(sample));
                }

                this.leds.level = clamp(peak / 5, 0, 1);
            },

            reset() {
                cvSlew.reset(5);
                out.fill(0);
                this.leds.level = 0;
            }
        };
    },

    ui: {
        leds: ['level'],
        knobs: [
            { id: 'gain', label: 'Gain', param: 'gain', min: 0, max: 1, default: 0.8 }
        ],
        inputs: [
            {
                id: 'audio', label: 'In', port: 'audio', signal: 'audio',
                voltage: { min: -5, max: 5, normal: 0 }
            },
            {
                id: 'cv', label: 'CV', port: 'cv', signal: 'cv',
                voltage: { min: 0, max: 5, normal: 5 }
            }
        ],
        outputs: [{
            id: 'out', label: 'Out', port: 'out', signal: 'audio',
            voltage: { min: -5, max: 5 }
        }]
    }
};
~~~

The CV buffer starts at its declared 5V normal, so an unpatched CV input leaves the VCA open. Routing writes into that same array; disconnection restores 5V. reset() restores the slew helper to the same normal.

VCA tests should cover:

- Default gain and the 5V CV normal.
- Gain at minimum and maximum.
- CV at 0V, 2.5V, and 5V.
- Invalid upstream samples.
- Output range, LED range, stable buffers, and reset.

## Definition Reference

Required fields:

| Field | Contract |
|---|---|
| id | Unique lowercase kebab-case ID. |
| name | Non-empty display name. |
| hp | One of 2, 3, 4, 6, 8, 10, 12, 14, or 16. |
| color | module-color-one through module-color-twelve. |
| category | midi, clock, source, voice, modulation, sequencer, quantizer, filter, effect, utility, output, or other. |
| createDSP() | Factory returning the DSP contract below. |
| ui | Authoritative controls and ports schema. |

Optional fields:

| Field | Purpose |
|---|---|
| css | Module styles injected by the renderer. |
| render() | Bespoke panel renderer; requires telemetry. |
| telemetry | Bounded fields, methods, and optional incremental history. |
| role | Infrastructure role such as audio-output; ordinary modules omit it. |
| handleWorkletEvent() | Handles infrequent DSP events on the main thread. |
| captureRuntimeState() | Captures non-patch state such as loop buffers. |
| restoreRuntimeState() | Restores captured state into a new DSP instance. |

### DSP Instance

createDSP() receives sampleRate, bufferSize, blockSize, services, and audioCtx. It returns:

| Member | Contract |
|---|---|
| params | Contains every declared UI parameter path. Numeric leaves must be finite. |
| inputs | Stable Float32Array buffers matching input ports and normals. |
| outputs | Stable Float32Array buffers matching output ports. |
| leds | Optional object of values from 0 through 1. |
| process() | Fills every output sample for the block. |
| reset() | Expected for stateful modules; restores deterministic initial state. |
| dispose() | Optional cleanup for DSP-owned resources. |
| drainEvents() | Optional source of infrequent structured-cloneable events. |

Production DSP runs inside AudioWorkletProcessor. Services such as MIDI arrive through services. Allocate during creation, not inside the audio loop.

## UI Schema

Only parameters declared by knobs, switches, buttons, and actions are accepted:

~~~javascript
ui: {
    knobs: [],
    switches: [],
    buttons: [],
    actions: [],
    inputs: [],
    outputs: []
}
~~~

### Controls

Knobs support:

| Property | Required | Meaning |
|---|---|---|
| id | yes | Unique control ID. |
| label | yes | Short visible label. |
| param | yes | Exact path in params. |
| min / max | yes | UI range. |
| default | yes | Initial value; must match DSP. |
| step | no | Quantization step; omitted or 0 is continuous. |
| small | no | Compact knob presentation. |

Switches use id, label, param, and a default of 0 or 1.

Buttons use id, label, param, and default:

- Buttons with values render as enum banks.
- Buttons without values render as toggles.
- Do not mix the two forms in one buttons array; the first item selects rendering mode.

Declarative actions use id, label, param, mode, and default:

| Property | Meaning |
|---|---|
| mode | toggle, momentary, or trigger. |
| durationMs | Supported by toolkit.createActionButton() in custom renderers; declarative trigger actions use 80ms. |

All rendered parameter controls expose MIDI-learn metadata. There is no action-level MIDI flag.

### Ports and Voltages

Each port uses id, label, port, signal, and optional voltage.

| Signal | Default range | Input normal |
|---|---:|---:|
| audio | -5V to 5V | 0V |
| cv | -5V to 5V | 0V |
| gate | 0V to 10V | 0V |
| trigger | 0V to 10V | 0V |
| any | -10V to 10V | 0V |

Override hardware behavior with voltage containing min, max, and, for inputs, normal. Initialize the DSP input buffer to the same normal; contract tests verify it.

Signal labels are semantic rather than a cable barrier. Eurorack is DC-coupled, but direction, endpoint existence, one-source-per-input, and buffer sizes are strict.

## Declarative and Custom UI

Declarative UI is preferred. For dense ports, socketLayout replaces default input/output sections:

~~~javascript
socketLayout: {
    label: 'I/O',
    columns: [
        { columns: 1, ports: ['audio', 'cv'] },
        {
            columns: 2,
            ports: [
                { port: 'out', label: 'Main' },
                { port: 'gate', label: 'Gate' }
            ]
        }
    ]
}
~~~

Socket references must match exact input or output port values. Columns also support label, className, and gridClassName.

For a bespoke panel:

~~~javascript
telemetry: { fields: [], methods: [] },

render(container, { toolkit, onParamChange, onCleanup }) {
    const button = document.createElement('button');
    const handleClick = () => onParamChange('record', 1);

    button.textContent = 'Record';
    button.addEventListener('click', handleClick);
    onCleanup(() => button.removeEventListener('click', handleClick));
    toolkit.registerParamControl('record', button, value => {
        button.classList.toggle('active', value === 1);
    });
    container.appendChild(button);
}
~~~

Every DSP-facing control, LED, input, and output still belongs in ui. Prefer toolkit createKnob, createSwitch, createButtonBank, createActionButton, createJack, createLED, createCanvas, and animate. Bound toolkit controls forward changes automatically.

The renderer's instance.dsp is the stable main-thread mirror, not the worklet DSP. Read it for displays, but call onParamChange() for audio changes. Use onCleanup() for listeners, observers, timers, and other teardown.

### Telemetry and Events

Custom renderers must declare telemetry, even when empty:

~~~javascript
telemetry: {
    fields: ['displayBuffer'],
    methods: ['getStats'],
    history: { field: 'history', maxEntries: 300 }
}
~~~

Params and LEDs always synchronize. Fields are structured-cloned, zero-argument methods become snapshot functions on the mirror, and history sends only appended entries. Keep all telemetry bounded.

For infrequent transferable results:

~~~javascript
// DSP
drainEvents() {
    const events = pendingEvents;
    pendingEvents = [];
    return events;
}

// Definition, main thread
handleWorkletEvent(event, { moduleId, instance }) {
    // Export a completed recording or perform browser-only work.
}
~~~

Do not use module events as continuous telemetry.

## Registration

### Built-In Modules

Add the module to MODULE_MANIFEST in **src/js/rack/module-manifest.js**:

~~~javascript
{ id: 'basic-lfo', load: () => import('../modules/basic-lfo/index.js') }
~~~

Manifest order is the deterministic processing-order tie break. Sidebar grouping comes from category.

AudioWorklet imports must be static. Also import the definition in **src/js/rack/core-definitions.js** and add it to CORE_MODULE_DEFINITIONS at the same position. The module-contract test rejects list or order drift.

### Trusted Plugins

Plugins are trusted JavaScript, not sandboxed extensions. Main-thread registration is atomic:

~~~javascript
import { registerPlugin } from './js/index.js';
import myModule from './my-module.js';

await registerPlugin({
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    apiVersion: 1,
    patchVersion: 1,
    workletUrl: new URL('./my-plugin.worklet.js', import.meta.url).href,
    modules: [{ id: 'my-module', definition: myModule }]
});
~~~

The worklet entry imports the same worklet-safe definition:

~~~javascript
import myModule from './my-module.js';

globalThis.registerEurorackWorkletPlugin({
    id: 'my-plugin',
    apiVersion: 1,
    patchVersion: 1,
    modules: new Map([['my-module', myModule]])
});
~~~

The host loads workletUrl only when an active patch declares the plugin. The processor verifies ownership and patchVersion. A plugin cannot unload while one of its module types is live.

Patch versions must match exactly. When patchVersion changes, update shipped patches and fixtures; the host does not run migrations.

## Factory Patches

Factory patches use strict schema version 3:

~~~javascript
export default {
    name: 'Test - Basic LFO',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'lfo', type: 'basic-lfo', row: 1, index: 0 },
            { id: 'scope', type: 'scope', row: 1, index: 1 }
        ],
        params: {
            lfo: { rate: 1 }
        },
        cables: [
            { fromModule: 'lfo', fromPort: 'sine', toModule: 'scope', toPort: 'in1' }
        ],
        midiMappings: {}
    }
};
~~~

Import the file in **src/js/config/patches/index.js** and add it to FACTORY_PATCHES.

Patch rules:

- type is the definition ID; id is the patch-local instance ID.
- Params use instance IDs and only declared UI parameter paths.
- Cables use exact port values, not labels or jack IDs.
- Each destination has one source; outputs may fan out.
- Plugin patches declare every owning plugin contract they use.
- test-{module} patches isolate one target with only necessary support modules.
- Multi-module musical ideas use demo naming and grouping.

Update README.md, AGENTS.md, research, and queue status for a built-in module. Update this guide only for a reusable authoring pattern.

## DSP Patterns

### Edge Detection

~~~javascript
let lastTrigger = 0;
const threshold = 1;

process() {
    for (let i = 0; i < bufferSize; i++) {
        const trigger = this.inputs.trigger[i];
        const rising = trigger >= threshold && lastTrigger < threshold;
        if (rising) {
            // Handle one edge.
        }
        lastTrigger = trigger;
    }
}
~~~

Use the documented threshold. Gates commonly use at least 1V, clocks/tap use more than 2.5V, and ARP advance uses more than 0.4V.

### Slew

~~~javascript
const slew = createSlew({ sampleRate, timeMs: 5 });
slew.reset(initialValue);

for (let i = 0; i < bufferSize; i++) {
    const smoothed = slew.process(input[i]);
}
~~~

Reset helper state alongside module state.

### Phase, Pitch, and Aliasing

~~~javascript
phase += frequency / sampleRate;
phase -= Math.floor(phase);

const frequency = baseFrequency * Math.pow(2, vOct + semitones / 12);
~~~

Generate continuous sine waves directly. Naive saw, square, and pulse discontinuities are acceptable for low-frequency control signals, but audio-rate oscillators require PolyBLEP or another documented anti-aliasing method.

### Finite Guards

Do not assume upstream output is valid:

~~~javascript
const sample = Number.isFinite(input[i]) ? input[i] : 0;
out[i] = clamp(sample, -5, 5);
~~~

clamp() limits finite values; it does not turn NaN into a valid sample.

## Testing Checklist

Cover every applicable contract:

1. Initialization and matching UI/DSP defaults.
2. Buffer types, lengths, identities, and normals.
3. Finite output filling the complete block.
4. Declared output voltage ranges.
5. Every knob at minimum, default, and maximum.
6. Every CV input and its scaling.
7. Trigger/gate edges and thresholds.
8. Every switch, button, action, and mode.
9. LED state and bounds.
10. Complete reset, including helpers and histories.
11. Dispose, runtime state, telemetry, and events when present.
12. Manufacturer-specific research targets.

Use Number.isFinite for buffer integrity:

~~~javascript
expect(output.every(Number.isFinite)).toBe(true);
~~~

## Troubleshooting

| Problem | Check |
|---|---|
| Patch or parameter rejected | Exact v3 plugin contract, instance ID, declared parameter, and finite value. |
| No output | Complete buffer writes, cable endpoints, processing order, and voltage scale. |
| NaN or Infinity | Division guards and Number.isFinite before clamping. |
| Clicks or zipper noise | Slew amplitude/frequency controls and clean envelope endings. |
| Trigger misses or repeats | Threshold, rising-edge state, and update order. |
| Input remains connected | Never replace input buffers; the graph restores normals. |
| Custom display is blank | Declare every renderer-read telemetry value. |
| UI changes do not affect sound | Call onParamChange(); mirror mutation does not reach worklet DSP. |
| Browser API fails in DSP | Emit a module event and handle it on the main thread. |
| Plugin topology fails | Worklet registration, ownership, API version, and patch version. |
