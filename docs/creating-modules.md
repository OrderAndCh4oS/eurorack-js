# Creating Modules

This guide takes a module from research through DSP, UI, registration, patches, and tests. It covers built-in modules and trusted plugins. Read [Codebase Architecture and Schemas](architecture.md) first for thread ownership and routing.

Account saves and public patches accept built-in modules only. You can develop your own modules locally in **Code → Modules**, then submit a tested contribution through a [GitHub pull request](https://github.com/OrderAndCh4oS/eurorack-js/pulls). It becomes available for account saves and public patches after maintainer review, merge and deployment. See [Contribute a module](#contribute-a-module).

## Browser-local Authoring

Open **Code → Modules** to search built-in source or work on your own definitions. **Your modules** appears first. Built-in files are read-only and load when selected. **New module** creates a starter draft; **Import own module** loads your own JavaScript file without executing it.

Local source must be a self-contained ES module with a default-exported definition. Import declarations, dynamic imports and re-exports are unsupported. Include any helpers within the file; built-in source can use repository imports that a local draft cannot use.

**Save** stores an inert draft in this browser's local storage. **Use module** saves and executes the code, retains an immutable executable revision, and adds an instance to the rack. This runs trusted JavaScript, outside the patch-script sandbox. The source restrictions do not make it safe to run untrusted code.

Executable revisions use `local-<lowercase ULID>` IDs. Editing a draft and using it again does not replace revisions referenced by older patches. Dependencies load from local storage when using a module or opening a browser-saved patch that needs them. Drafts and revisions do not sync to an account, and patch links do not include their source. Keep your own source backups.

See [Work with Module Source](patch-workbench-guide.md#12-work-with-module-source) for the editor workflow. The DSP and panel contracts below apply to local definitions too.

## Contract at a Glance

A definition is instantiated on both threads:

- The main thread creates a stable UI mirror.
- The AudioWorklet creates the production DSP instance when audio starts. Registration also creates a temporary DSP instance to validate its contract.

The **ui** declaration is the public schema. Every DSP-facing parameter and port must be declared there. Visible parameters use controls; patch-persisted values without a control use `ui.state`. Unknown parameters, missing module IDs, non-object parameter groups, non-finite values, invalid ports, and plugin contract mismatches are rejected.

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
npm test -- tests/config/patch-catalogs.test.js tests/config/factory-patches.test.js tests/app/patch-format.test.js
~~~

Before merge:

~~~bash
npm test
npm run audit:dsp -- --module {moduleId} --matrix --strict-voltage
~~~

## Tutorial 1: Basic LFO

This sine LFO demonstrates metadata, sample-rate-aware state, a finite parameter, a +/-5V output, LED state, stable buffers, and reset.

Create **src/js/modules/basic-lfo/index.js**:

~~~javascript
import { wrapPhase } from '../../utils/oscillator.js';

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
                    phase = wrapPhase(phase + rate / sampleRate);
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
- `wrapPhase()` keeps normalized phase bounded over long sessions and handles negative modulation.
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
| diagnostics | Static rack connection checks; may declare terminalInputs. |
| role | Infrastructure role such as audio-output; ordinary modules omit it. |
| handleWorkletEvent() | Handles infrequent DSP events on the main thread. |
| applyRuntimeCommand(dsp, command) | Installs local runtime media on the owning instance. This hook requires both runtime-state hooks. |
| captureRuntimeState(dsp) | Captures non-patch state such as loop buffers. |
| restoreRuntimeState(dsp, state) | Restores captured state into a new DSP instance. |

For a monitor or recorder that is useful without connecting its pass-through outputs, declare `diagnostics: { terminalInputs: ['audio'] }` using its exact input port names. The debugger accepts a connected terminal input as a destination and follows upstream audio, CV, and trigger paths. A display trigger alone is not a terminal input. These ports must be unique declared inputs; ordinary processors omit this metadata. Speaker outputs use `role: 'audio-output'` instead. Connection checks do not infer whether a patch is audible or require every individual input or output to be used.

### DSP Instance

`createDSP()` receives `sampleRate`, `bufferSize`, and `blockSize`. The host and processor also supply a `services` object; default it to `{}` because registration-time validation does not supply services. `audioCtx` is always `null`: DSP must not create Web Audio nodes. It returns:

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
| onInputConnected(port) | Optional notification when an input becomes connected in the worklet topology. |
| onInputDisconnected(port) | Optional notification after a disconnected input has been restored to its normal. |

Production DSP runs inside AudioWorkletProcessor. Services such as MIDI arrive through `services`; note and clock events include a `sampleOffset` and are non-destructive for the current block. Allocate during creation, not inside the audio loop, and never fall back to `window` or other browser globals.

## UI Schema

Parameters declared by knobs, switches, buttons, actions, and non-rendered state are accepted:

~~~javascript
ui: {
    knobs: [],
    switches: [],
    buttons: [],
    actions: [],
    state: [],
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

Switches default to the values 0 and 1. Use `values: [1, 2]` for a switch
that sends literal octave counts. Use `positions: ['Off', 'HP', 'LP']` for
named settings indexed from zero. Every declared position is selectable
from the panel and through MIDI Learn.

Buttons use id, label, param, and default:

- Buttons with values render as enum banks.
- Buttons without values render as toggles.
- Do not mix the two forms in one buttons array; the first item selects rendering mode.

Declarative actions use id, label, param, mode, and default:

| Property | Meaning |
|---|---|
| mode | toggle, momentary, or trigger. |
| durationMs | Supported by toolkit.createActionButton() in custom renderers; declarative trigger actions use 80ms. |
| editState | Optional for a trigger. Declare the target `ui.state` path as `param` and a pure `update(params)` function returning its replacement value. The rack and audio processor each apply the edit once per rising transition. |

Trigger and momentary actions are transient commands. Patch loading restores
them to their declared defaults rather than replaying a captured high pulse;
toggle actions remain patch-persisted. Renderer cleanup also releases any
active trigger and cancels its delayed callback before a module is removed or
replaced.

All rendered parameter controls expose MIDI-learn metadata. There is no action-level MIDI flag.
Compound controls need one assignment target per parameter. The joystick
shows X and Y buttons on the pad while MIDI Learn is active. Choosing a
target leaves its current value in place.

### Patch-Persisted State

Use `ui.state` for finite structured values that belong in a patch but are not direct controls, such as a learned tuning table:

~~~javascript
params: {
    scaleMemory: {}
},
ui: {
    state: [{ param: 'scaleMemory', default: {} }]
}
~~~

State values may contain nested objects and arrays whose numeric leaves are finite. They are validated and synchronized with the worklet like control parameters, but the renderer does not create a control and they are not MIDI-learn targets. A custom renderer must call `onParamChange('scaleMemory', nextValue)` after replacing the value. Prefer immutable replacement so rack state, URL encoding, and the worklet receive the same snapshot. Runtime-only bulk data such as audio buffers still belongs in `captureRuntimeState()` rather than patch params.

### Ports and Voltages

Each port uses id, label, port, signal, and optional voltage.

| Signal | Default range | Input normal |
|---|---:|---:|
| audio | -5V to 5V | 0V |
| cv | -5V to 5V | 0V |
| gate | 0V to 10V | 0V |
| trigger | 0V to 10V | 0V |
| any | -10V to 10V | 0V |

Override hardware behavior with voltage containing min, max, and, for inputs, normal. The normal must fall inside the inclusive range. Initialize the DSP input buffer to that voltage.

All five scalar signal labels in the table can connect to each other. The rack enforces jack direction, endpoint existence, one source per input, and stable block-sized buffers. The built-in OCTO pair reserves `octo-link` for the eight-lane cable from Send LINK to Receive LINK. Other modules use their usual scalar ports to patch into the numbered jacks. [Compiled signal graph](architecture.md#compiled-signal-graph)

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

For a bespoke panel, this renderer assumes `record` is declared as a toggle parameter in `ui`:

~~~javascript
telemetry: { fields: [], methods: [] },

render(container, { toolkit, onParamChange, onCleanup }) {
    const button = document.createElement('button');
    const handleClick = () => onParamChange('record', button.classList.contains('active') ? 0 : 1);

    button.textContent = 'Record';
    button.addEventListener('click', handleClick);
    onCleanup(() => button.removeEventListener('click', handleClick));
    toolkit.registerParamControl('record', button, value => {
        button.classList.toggle('active', value === 1);
    });
    container.appendChild(button);
}
~~~

Every DSP-facing control, LED, input, and output still belongs in ui. Prefer toolkit createKnob, createSwitch, createButtonBank, createActionButton, createJack, createLED, createCanvas, and animate. Bound toolkit controls forward changes by default. If you supply a custom `onChange` callback, it must call `onParamChange(param, value)` itself.

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

LEDs synchronize on every snapshot. By default the worklet includes every DSP parameter. To limit snapshot traffic, supply `telemetry.params` with the declared parameter paths changed by your DSP. Use `params: []` when all edits originate in the host. The host still delivers every control and state change to the DSP. Gate Seq uses this setting to keep its pattern and preset memories out of display snapshots.

Fields are structured-cloned and zero-argument methods become snapshot functions on the mirror. History sends the latest entry when its identity changes at a telemetry update; intermediate entries can be skipped. Use it for bounded display history, not lossless capture.

For infrequent transferable results:

~~~javascript
// DSP
drainEvents() {
    const events = pendingEvents;
    pendingEvents = [];
    return events;
}

// Definition, main thread
handleWorkletEvent(event, { moduleId, instance, services, audioCtx }) {
    // Export a completed recording or perform browser-only work.
}
~~~

MIDI OUT batches gate transitions per render block. Its browser handler uses the injected MIDI service and audio context to timestamp the notes for the selected port. When a live instance is replaced, the worklet drains its final events after disposal so it can release a held note.

Do not use module events as continuous telemetry.

For a user-selected file, a custom renderer can call `await onRuntimeCommand(command, [pcm.buffer])`. Decode and bound the file before sending it. The module's synchronous `applyRuntimeCommand(dsp, command)` validates the command in either runtime and replaces only the requested media. Transfer the disposable decoded buffer and handle a rejected request on the panel. Preview renderers omit the callback. The Slice Sampler demonstrates this pattern and keeps both its PCM and filename out of the patch.

Large bounded results should use coarse chunks rather than allocating one typed array per render quantum. Include an exact valid sample count when the final transferable chunk can contain padding.

## Registration

### Built-In Modules

Add the module to MODULE_MANIFEST in **src/js/rack/module-manifest.js**:

~~~javascript
{ id: 'basic-lfo', load: () => import('../modules/basic-lfo/index.js') }
~~~

Manifest order is the deterministic processing-order tie break. Sidebar grouping comes from category.

The core AudioWorklet graph uses static imports. Also import the definition in **src/js/rack/core-definitions.js** and add it to CORE_MODULE_DEFINITIONS at the same position. Keep the file's aliases sequential (`m0` through `mN`) with no gaps in either list. The module-contract test rejects ID, order, or alias drift.

Adding or removing a built-in changes the static worklet graph. Bump the matching core graph revision in **audio/worklet-engine.js**, **audio/worklet/processor.js**, and **audio/worklet/core-plugin.js** so an already-cached browser loads the new registry. Revisions use `<date>-<serial>-<digest>`; `<digest>` is the first eight hex characters of SHA-256 over the ordered `alias:import-path:module-id` tuples joined by newlines. The contract test requires all three revisions to match the current graph fingerprint.

### Trusted Plugins

The trusted plugin API remains available for local development and embedding. It does not upload modules or publish them to other users. Plugins are trusted JavaScript, not sandboxed extensions. Main-thread registration is atomic:

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

The host loads workletUrl when preparing an audio topology that declares the plugin. The processor verifies ownership and patchVersion. The main-thread registry rejects unregistration while one of the plugin's module types is live; unregistering does not unload code already loaded into an AudioWorklet context.

Patch versions must match exactly. When patchVersion changes, update shipped patches and fixtures; the host does not run migrations.

### Saving and Sharing Custom Modules

Registering a trusted plugin makes its modules available in that browser context. It does not publish the plugin or make it available to other browsers.

Private account saves, public patches and cloud previews accept built-in modules only. Module JavaScript and external or browser-local plugin dependencies are rejected at those boundaries. Your own local definitions can be used and saved in this browser, but they are not a public module catalogue.

Version 3 patches record plugin IDs and patch contract versions, not plugin source or exact package releases. A local save or snapshot link does not bundle the missing code.

New modules become available to all users through the contribution workflow below. There is no uploaded plugin catalogue or self-service module publication. The [custom module sharing decision](custom-module-sharing-plan.md) records this boundary.

## Contribute a module

1. Follow [Research Before Implementation](#research-before-implementation) and the [Queue and Worktree Workflow](#queue-and-worktree-workflow). Keep the panel contract, voltage behavior, DSP choices and assumptions in `research/modules/{moduleId}.md`.
2. Write focused DSP tests before implementation. Add the module, built-in registration, worklet graph revision, a useful test patch and documentation using this guide. A local plugin prototype must be integrated as a built-in before it can ship in the hosted app.
3. Run the focused DSP, module-contract and queue tests listed above, plus the patch tests when fixtures change. Run `npm run audit:dsp -- --module {moduleId} --matrix --strict-voltage` and `npm test`. Include the results and any known limitations in the PR.
4. Test in the local browser rack with real AudioWorklet playback. Check controls, displays, cable connection/disconnection, reset and audio start/stop. Listen at default settings and parameter extremes, check modulation and pitch behavior where relevant, and reload the test patch. Report the browser used, audible artifacts, CPU concerns and checks performed.
5. Submit a [GitHub pull request](https://github.com/OrderAndCh4oS/eurorack-js/pulls) containing the source, cited research, tests, test patch and documentation. Maintainers review the implementation, dependencies, sound and runtime behavior. Passing tests supports that review; it does not prove that submitted code is safe or ready to ship.

After maintainer approval, merge and deployment, the module is built into the hosted app and can be used in account and public patches. A PR alone does not make a local module available to other users.

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

For a module or integration test, import the file in **src/js/config/test-patches.js** and add it to `TEST_PATCHES`. It appears in the **Module demos** directory and is automatically included in the complete `FACTORY_PATCHES` regression catalogue. The app imports this test catalogue directly so archived examples are not loaded with the test view.

For a built-in module, add its title, introduction and test patch name to [the module directory](../src/js/config/module-demos.js). Write its guide in **docs/modules/{moduleId}.md**. Follow the [VCO guide](modules/vco.md) for the listening exercise, composition example, panel reference and research link. The docs build turns the **Open in rack** link into a themed preview of that patch.

Retained musical examples are exported as `ARCHIVED_DEMO_PATCHES` from **src/js/config/patches/index.js** and are available in the [importable archive](../archive/demo-patches/README.md). Update that archive's JSON alongside source changes. New user/community compositions belong in the patch library rather than the built-in test catalogue.

Patch rules:

- type is the definition ID; id is the patch-local instance ID.
- Params use instance IDs and only declared UI parameter paths.
- Cables use exact port values, not labels or jack IDs.
- Each destination has one source; outputs may fan out.
- Plugin patches declare every owning plugin contract they use.
- test-{module} patches isolate one target with only necessary support modules.
- Test entries can cover multiple modules when their purpose is an integration check.
- Retained musical demos, sound effects, and drum compositions stay in the archive, outside the Module demos directory.

Update README.md, AGENTS.md, research, and queue status for a built-in module. Update this guide only for a reusable authoring pattern.

## DSP Patterns

### Shared Utility Library

Use these optional primitives instead of copying their mathematics into a module. Utilities never own module parameters, oscillator voices, delay policy, or reset behavior; modules own that state and decide whether a helper fits their DSP model.

| File | Public API | Use |
|---|---|---|
| `utils/math.js` | `clamp`, `expMap` | Ordered bounds and normalized exponential control mapping. `expMap` requires positive bounds. |
| `utils/oscillator.js` | `wrapPhase`, `polyBlep` | Normalized `[0, 1)` phase wrapping and correction around saw/pulse discontinuities. |
| `utils/interpolation.js` | `linearInterpolate`, `createLinearCircularReader` | Linear sample interpolation and allocation-free fractional reads from a fixed circular typed array. Create readers once in `createDSP()`. |
| `utils/slew.js` | `createSlew` | Stateful one-pole RC smoothing. Reset the helper with the module and use a positive sample rate. |
| `utils/voltage.js` | `softLimitVoltage` | Linear response below a configurable knee and smooth bounded overload. Use only where the module's documented voltage policy calls for saturation. |
| `utils/fft.js` | `createRealFft` | Preallocated Hann-window real FFT calibrated against a voltage reference. Create once, reuse its output buffer, and keep analyzer work bounded. |

All APIs above are exported by `src/js/index.js` for external trusted plugins. The infrastructure-only `utils/color.js` and `utils/nested-access.js` support renderer/theme and validated parameter/port paths; module DSP should not depend on them.

### Generated Lookup Plans

When a deterministic musical search is too expensive for the audio thread,
keep a pure generator beside the module and check in its fixed-size result as a
typed-array data module. Runtime code should expose only indexed reads from a
private table; it must not search, sort, or allocate inside `process()`.

Keep the generator as the normative oracle. Focused tests should regenerate the
entire table and compare every entry, or compare an exact checksum plus
exhaustive golden vectors. A defensive snapshot is useful for validation
without making the runtime table mutable to consumers. Document the indexing
order, bounds, tie-breaks, generator version or checksum, and the reason
runtime generation was rejected.

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
const frequency = baseFrequency * Math.pow(2, vOct + semitones / 12);
phase = wrapPhase(phase + frequency / sampleRate);
~~~

Generate continuous sine waves directly. Naive saw, square, and pulse discontinuities are acceptable for low-frequency control signals, but audio-rate oscillators require `polyBlep()` or another documented anti-aliasing method.

### Finite Guards

Do not assume upstream output is valid:

~~~javascript
const sample = Number.isFinite(input[i]) ? input[i] : 0;
out[i] = clamp(sample, -5, 5);
~~~

clamp() limits finite values; it does not turn NaN into a valid sample.

## Testing Checklist

The rack generates a gesture-to-worklet check for every declared control and
observes reads while the DSP processes a signal, the panel draws, or an action
edits saved state. Telemetry serialization is excluded from the read check.
For a custom widget, exercise its actual gesture and check the intended
parameter on the audio thread. For a musical or display promise, give the
module a signal or state that makes the effect measurable. Both VCA channels
share the same gain fixture. SCOPE checks the actual drawn trace on a ramp.
The three Bend specifications and their verification commands are described
in [Rack laws](../laws/README.md).

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
