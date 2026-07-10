# Creating Modules

This guide covers everything you need to know to create custom modules for eurorack-js.

## Module Structure

Each module is a self-contained folder under `src/js/modules/`:

```
src/js/modules/mymodule/
└── index.js
```

The `index.js` exports a module definition object:

```javascript
export default {
    // Metadata
    id: 'mymodule',
    name: 'My Module',
    hp: 4,
    color: 'module-color-six',
    category: 'utility',

    // DSP factory
    createDSP(options) { ... },

    // UI definition
    ui: { ... }
};
```

## Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (lowercase, no spaces) |
| `name` | string | Display name shown in UI |
| `hp` | number | Panel width (2, 3, 4, 6, 8, 10, 12, 14, or 16) |
| `color` | string | Theme color token. Use one of `module-color-one` through `module-color-twelve`. Six-digit hex colors are accepted only as a custom-module fallback. |
| `category` | string | Sidebar category owned by the module definition. Must be one from `CATEGORY_ORDER` in `src/js/rack/module-manifest.js`: `midi`, `clock`, `source`, `voice`, `modulation`, `sequencer`, `quantizer`, `filter`, `effect`, `utility`, `output`, `other` |

## Research Before Implementation

Before creating a hardware-inspired module, create or update `research/modules/{moduleId}.md`. Use the research note to define the module contract before writing DSP or UI.

Capture:

1. Primary references: manufacturer page, manual/PDF, official firmware/source, product announcements, press releases, archived product pages, calibration notes, and hidden modes.
2. Historical/context references when useful: old synth magazines, zines, catalogs, interviews, mailing-list posts, forum threads, patents, academic papers, app notes, and trade-show coverage.
3. Reviews and demos: manufacturer demos, independent video demos, written reviews, forum sound examples, and comparison shootouts. Note observed sonic behavior, quirks, settings, and patch context.
4. Practical secondary references: ModularGrid specs/panel image, retailer pages, trusted reviews, and user reports that describe behavior not captured in official specs.
5. Panel inventory: every knob, switch, button, jack, LED, normalized connection, mode, and alternate function.
6. Electrical behavior: audio/CV/gate/trigger ranges, thresholds, pulse lengths, pitch tracking, clipping, reset behavior, calibration tolerances, and modulation scaling.
7. Source quality: note contradictions, which source wins, and why. Prefer primary specs for electrical facts unless better evidence is documented.
8. DSP decision: whether the implementation is faithful, inspired-by, or adapted for this app, with trade-offs and source links.
9. Test targets: output ranges, knob extremes, CV response, trigger edges, reset behavior, LEDs, buffer integrity, and spec-specific behavior.

If a hardware detail cannot be verified, document the assumption and choose a range consistent with this app's voltage standards and similar modules.

Every source entry should include title, author/publisher when known, date or approximate era, URL/archive URL, access date for unstable pages, and a short note explaining what fact or design choice it supports.

## Processing Queue Candidates

Use `research/module-queue.md` as the candidate board. A module must move through `candidate`, `researching`, `spec-ready`, `implementing`, and `done`; use `blocked` when a source contradiction or architecture issue prevents progress.

To have Codex process a queued module end to end, use the copy-paste prompt in `docs/codex-process-module-command.md`.

Do not start implementation until the queue item is `spec-ready`. At that point the research doc must define the panel contract, voltage contract, DSP plan, assumptions, contradictions, and test targets.

For parallel work, isolate each module in its own branch or worktree:

```bash
git worktree add ../eurorack-js-{moduleId} -b module/{moduleId}
```

Use `research/{moduleId}` for research-only branches and `module/{moduleId}` for implementation branches. Keep shared infrastructure changes out of module branches unless they are explicitly part of that module's approved plan.

Before writing module code, add this plan to `research/modules/{moduleId}.md`:

```markdown
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
```

Minimum focused validation for a new module:

```bash
npm test -- tests/dsp/{moduleId}.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js
```

If adding or changing a factory patch, also run:

```bash
npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js
```

Before merge, run:

```bash
npm test
```

## The DSP Factory

The `createDSP` function returns a DSP instance:

```javascript
createDSP({ sampleRate = 44100, bufferSize = 512, audioCtx } = {}) {
    // Allocate output buffers (persisted across process calls)
    const out = new Float32Array(bufferSize);

    // Internal state
    let phase = 0;

    return {
        // Knob/switch values (set by UI)
        params: {
            frequency: 0.5,
            mode: 0
        },

        // Input buffers (connected by cables or defaults)
        inputs: {
            cv: new Float32Array(bufferSize),
            trigger: new Float32Array(bufferSize)
        },

        // Output buffers (read by downstream modules)
        outputs: { out },

        // LED brightness values (0-1, read by UI)
        leds: { active: 0 },

        // Called every audio frame
        process() {
            for (let i = 0; i < bufferSize; i++) {
                // DSP code here
                out[i] = Math.sin(phase) * 5;
                phase += 0.01;
            }
        },

        // Optional: reset state
        reset() {
            phase = 0;
            out.fill(0);
        }
    };
}
```

## UI Definition

The `ui` object declares the module's interface:

```javascript
ui: {
    leds: ['active', 'clip'],

    knobs: [
        { id: 'freq', label: 'Freq', param: 'frequency', min: 0, max: 1, default: 0.5 },
        { id: 'res', label: 'Res', param: 'resonance', min: 0, max: 1, default: 0.3 }
    ],

    switches: [
        { id: 'mode', label: 'Mode', param: 'mode', default: 0 }
    ],

    buttons: [
        { id: 'range', label: 'Range', param: 'range', values: [0, 1, 2], default: 1 }
    ],

    actions: [
        { id: 'record', label: 'Rec', param: 'record', mode: 'toggle', default: 0 },
        { id: 'clear', label: 'Clear', param: 'clear', mode: 'trigger', default: 0 }
    ],

    inputs: [
        { id: 'audio', label: 'In', port: 'audio', type: 'audio' },
        { id: 'cv', label: 'CV', port: 'cv', type: 'cv' }
    ],

    outputs: [
        { id: 'out', label: 'Out', port: 'out', type: 'audio' }
    ]
}
```

### Knob Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique ID for this knob |
| `label` | string | Display label (short) |
| `param` | string | Maps to `params.{param}` |
| `min` | number | Minimum value |
| `max` | number | Maximum value |
| `default` | number | Initial value |

### Switch Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique ID |
| `label` | string | Display label |
| `param` | string | Maps to `params.{param}` |
| `default` | number | Initial state (0 or 1) |

### Button Properties

Buttons support two declarative modes:

- A button with `values` renders as a compact button bank for enum-style params.
- Buttons without `values` render as toggle buttons in a common Gates row.

Do not mix button banks and toggle buttons in one declarative `buttons` array. The renderer chooses the mode from the first button.

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique ID |
| `label` | string | Display label or tooltip text |
| `param` | string | Maps to `params.{param}` |
| `values` | number[] | Optional enum values for a button bank |
| `default` | number | Initial value |

### Action Properties

Use `actions` for MIDI-visible non-knob controls whose behavior is not a value bank: transport buttons, momentary gates, and trigger commands. Action values are still stored in `params` and patch state.

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique ID |
| `label` | string | Display label or tooltip text |
| `param` | string | Maps to `params.{param}` |
| `mode` | string | `toggle`, `momentary`, or `trigger` |
| `default` | number | Initial value |
| `midi` | boolean | Optional MIDI visibility flag; DSP-facing actions should normally be MIDI-visible |

### Jack Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique ID |
| `label` | string | Display label |
| `port` | string | Maps to `inputs.{port}` or `outputs.{port}` |
| `type` | string | Signal type (see below) |

### Port Types

| Type | Description | Typical Range |
|------|-------------|---------------|
| `audio` | Audio signals | ±5V |
| `cv` | Control voltage | 0-5V or ±5V |
| `gate` | On/off signals | 0V / 10V |
| `trigger` | Short pulses | 5-10V pulse |
| `buffer` | Generic buffer | varies |

### Advanced UI Layout

The default declarative renderer lays out controls in this order:

1. LEDs
2. Knobs
3. Switches
4. Buttons
5. Actions
6. Spacer
7. Outputs
8. Inputs

For modules with many jacks, the generic input/output layout can become too tall. Use `ui.socketLayout` to replace the default output/input sections with a compact socket block while keeping declarative knobs, switches, buttons, and LEDs.

```javascript
ui: {
    knobs: [
        { id: 'time', label: 'Time', param: 'time', min: 0, max: 1, default: 0.5 }
    ],
    inputs: [
        { id: 'audio', label: 'In', port: 'audio', type: 'audio' },
        { id: 'timeCV', label: 'Time', port: 'timeCV', type: 'cv' },
        { id: 'tap', label: 'Tap', port: 'tap', type: 'trigger' }
    ],
    outputs: [
        { id: 'out', label: 'Out', port: 'out', type: 'audio' },
        { id: 'clock', label: 'Clock', port: 'clock', type: 'gate' }
    ],
    socketLayout: {
        columns: [
            { columns: 1, ports: ['audio', 'tap'] },
            { columns: 2, ports: ['out', 'clock', 'timeCV'] }
        ]
    }
}
```

`socketLayout.columns[].ports` must reference exact `port` values from `ui.inputs[]` or `ui.outputs[]`. Each column can also include:

| Property | Type | Description |
|----------|------|-------------|
| `columns` | number | Number of grid columns inside that socket group |
| `ports` | string[] or object[] | Port names, or objects like `{ port: 'timeCV', label: 'T CV' }` for a layout-specific label |
| `className` | string | Optional CSS class on the column |
| `gridClassName` | string | Optional CSS class on the grid |
| `label` | string | Optional group label. Avoid this unless it adds information beyond jack labels. |

`socketLayout.label` or `socketLayout.section` adds a section divider above the socket block. Avoid extra section/group labels on dense modules when the jack labels are already clear.

For a fully bespoke panel, export a `render(container, { instance, toolkit, onParamChange, onCleanup })` function instead of relying only on declarative `ui`. Custom renderers may create arbitrary DOM, but every rendered DSP-facing param, LED, input, and output must be declared in `ui`. Display-only controls such as copy/save/export buttons can stay custom-render-only if they do not change module params.

Use `toolkit.createKnob`, `toolkit.createSwitch`, `toolkit.createButtonBank`, `toolkit.createActionButton`, and `toolkit.createJack` where possible; those helpers are bound to the module id and forward param changes to the app. If you create controls manually, call `onParamChange(param, value)` whenever a value changes.

For custom visual controls whose state cannot be synced by a standard toolkit class, register a sync hook:

```javascript
render(container, { toolkit, onParamChange }) {
    const recButton = document.createElement('button');
    recButton.className = 'my-rec-button';
    recButton.addEventListener('click', () => onParamChange('record', 1));
    toolkit.registerParamControl('record', recButton, value => {
        recButton.classList.toggle('recording', value === 1);
    });
    container.appendChild(recButton);
}
```

For animation, use `toolkit.animate(draw)` instead of calling `requestAnimationFrame` directly. The renderer stops managed animations automatically when the module is removed or rerendered.

```javascript
render(container, { toolkit }) {
    const canvas = toolkit.createCanvas({ width: 180, height: 80 });
    const ctx = canvas.getContext('2d');
    container.appendChild(canvas);

    toolkit.animate(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // draw current DSP state
    });
}
```

Use `onCleanup(fn)` for other teardown work such as event listeners, observers, or timers. Custom renderers can read live DSP/UI state with `instance.getModule()`.

## Voltage Standards

Eurorack uses voltage to represent everything:

### Audio Signals
- Range: **±5V** (bipolar)
- 0V = silence
- Generated by: VCO, noise, filters

### Control Voltage (CV)
- Range: **0-5V** (unipolar) or **±5V** (bipolar)
- Used for: modulation, parameter control
- Generated by: LFO, envelope, S&H

### Gates
- Off: **0V**
- On: **10V**
- Threshold: **≥1V** considered "on"
- Used for: note on/off, hold signals

### Triggers
- Short pulse: **5-10ms** at **5-10V**
- Threshold depends on input role: many gate-style triggers use **≥1V**, clocks/tap commonly use **>2.5V**, ARP advance uses **>0.4V**
- Used for: clock, reset, note events

### Pitch CV (1V/Octave)
- **0V** = base frequency
- **+1V** = one octave up (2x frequency)
- **+0.0833V** = one semitone up

```javascript
// V/Oct to frequency
const freq = baseFreq * Math.pow(2, vOct);

// With semitone offset
const freq = baseFreq * Math.pow(2, vOct + semitones/12);
```

## Common DSP Patterns

### Edge Detection (Triggers/Gates)

```javascript
let lastTrig = 0;
const TRIGGER_THRESHOLD = 1; // Use 2.5 for clock/tap inputs, or a documented module-specific threshold.

process() {
    for (let i = 0; i < bufferSize; i++) {
        const trig = this.inputs.trigger[i];

        // Rising edge detection
        if (trig >= TRIGGER_THRESHOLD && lastTrig < TRIGGER_THRESHOLD) {
            // Trigger fired!
        }

        // IMPORTANT: Update AFTER the check
        lastTrig = trig;
    }
}
```

### Slew Limiting (Smoothing)

Use `createSlew` from the utils to smooth parameter changes and prevent clicks:

```javascript
import { createSlew } from '../../utils/slew.js';

createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
    const slew = createSlew({ sampleRate, timeMs: 5 });

    return {
        process() {
            for (let i = 0; i < bufferSize; i++) {
                const smoothedCV = slew.process(this.inputs.cv[i]);
                // Use smoothedCV instead of raw CV
            }
        }
    };
}
```

### Phase Accumulator (Oscillators)

```javascript
let phase = 0;

process() {
    const freq = 440; // Hz
    const phaseInc = freq / sampleRate;

    for (let i = 0; i < bufferSize; i++) {
        // Generate waveforms from phase (0-1)
        const saw = phase * 2 - 1;           // -1 to +1
        const sine = Math.sin(phase * 2 * Math.PI);
        const square = phase < 0.5 ? 1 : -1;

        // Scale to ±5V
        out[i] = saw * 5;

        // Advance and wrap phase
        phase += phaseInc;
        if (phase >= 1) phase -= 1;
    }
}
```

### LED Metering

```javascript
process() {
    let peak = 0;

    for (let i = 0; i < bufferSize; i++) {
        out[i] = /* ... */;
        peak = Math.max(peak, Math.abs(out[i]));
    }

    // Scale to 0-1 range (assuming ±5V signal)
    this.leds.level = peak / 5;
}
```

### LED Decay (Peak Hold)

```javascript
createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
    // Decay constant for ~100ms hold
    const ledDecay = Math.exp(-1 / (sampleRate * 0.1) * bufferSize);

    return {
        leds: { peak: 0 },

        process() {
            let currentPeak = 0;

            for (let i = 0; i < bufferSize; i++) {
                currentPeak = Math.max(currentPeak, Math.abs(out[i]));
            }

            // Peak hold with decay
            this.leds.peak = Math.max(currentPeak / 5, this.leds.peak * ledDecay);
        }
    };
}
```

### Handling Unpatched Audio Inputs

Audio inputs should produce silence when disconnected. Use this pattern:

```javascript
createDSP({ bufferSize }) {
    const ownAudioIn = new Float32Array(bufferSize);

    return {
        inputs: {
            audio: ownAudioIn
        },

        clearAudioInputs() {
            ownAudioIn.fill(0);
            this.inputs.audio = ownAudioIn;
        },

        process() {
            // Use this.inputs.audio...

            // Reset if cable was connected then removed
            if (this.inputs.audio !== ownAudioIn) {
                ownAudioIn.fill(0);
                this.inputs.audio = ownAudioIn;
            }
        }
    };
}
```

## Complete Example: Simple VCA

```javascript
// src/js/modules/simplevca/index.js
import { clamp } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';

export default {
    id: 'simplevca',
    name: 'VCA',
    hp: 2,
    color: 'module-color-eleven',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const ownAudioIn = new Float32Array(bufferSize);

        const cvSlew = createSlew({ sampleRate, timeMs: 5 });
        const ledDecay = Math.exp(-1 / (sampleRate * 0.1) * bufferSize);

        return {
            params: { gain: 0.8 },

            inputs: {
                audio: ownAudioIn,
                cv: new Float32Array(bufferSize).fill(5)
            },

            outputs: { out },

            leds: { level: 0 },

            clearAudioInputs() {
                ownAudioIn.fill(0);
                this.inputs.audio = ownAudioIn;
            },

            process() {
                const gain = clamp(this.params.gain, 0, 1);
                let peak = 0;

                for (let i = 0; i < bufferSize; i++) {
                    // Smooth CV to prevent clicks
                    const cv = cvSlew.process(this.inputs.cv[i]);
                    const cvGain = clamp(cv / 5, 0, 1);

                    // Apply both manual gain and CV
                    const sample = this.inputs.audio[i] * gain * cvGain;
                    out[i] = sample;

                    peak = Math.max(peak, Math.abs(sample));
                }

                // Update LED with peak hold
                this.leds.level = Math.max(peak / 5, this.leds.level * ledDecay);

                // Handle disconnected input
                if (this.inputs.audio !== ownAudioIn) {
                    ownAudioIn.fill(0);
                    this.inputs.audio = ownAudioIn;
                }
            },

            reset() {
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
            { id: 'audio', label: 'In', port: 'audio', type: 'audio' },
            { id: 'cv', label: 'CV', port: 'cv', type: 'cv' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'audio' }
        ]
    }
};
```

## Registering Your Module

Add your module to `MODULE_MANIFEST` in `src/js/rack/module-manifest.js`:

```javascript
export const MODULE_MANIFEST = [
    // ... existing modules
    { id: 'mymodule', load: () => import('../modules/mymodule/index.js') }
];
```

The registry loads modules from the manifest, and `MODULE_ORDER` is derived from manifest order. That order controls default processing-order tie breaks. Sidebar grouping comes from the module definition's `category` field.

## Factory Patches and Docs

If the module should ship with a test or demo patch, add a version 2 factory patch in `src/js/config/patches/`:

```javascript
export default {
    name: 'Test My Module',
    factory: true,
    state: {
        version: 2,
        modules: [
            { id: 'my1', type: 'mymodule', row: 1, index: 0 },
            { id: 'out1', type: 'out', row: 1, index: 1 }
        ],
        params: {
            my1: { gain: 0.7 }
        },
        cables: [
            { fromModule: 'my1', fromPort: 'out', toModule: 'out1', toPort: 'L' },
            { fromModule: 'my1', fromPort: 'out', toModule: 'out1', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
```

Then import and register it in `src/js/config/patches/index.js`:

```javascript
import testMyModule from './test-my-module.js';

export const FACTORY_PATCHES = {
    // ... existing patches
    [testMyModule.name]: testMyModule
};
```

Patch cable endpoints must use exact `port` values from each module's `ui.inputs[]` and `ui.outputs[]`; do not use the jack `id` or label unless it is also the port name.

For built-in modules, also update:

- `README.md` module table
- `AGENTS.md` available modules list
- `research/module-queue.md` status and research doc link
- `docs/creating-modules.md` only when the module introduces a new reusable pattern

## Testing Your Module

Create a test file at `tests/dsp/mymodule.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import myModule from '../../src/js/modules/mymodule/index.js';

const createMyModule = (options = {}) => myModule.createDSP(options);

describe('myModule', () => {
    let mod;

    beforeEach(() => {
        mod = createMyModule();
    });

    describe('initialization', () => {
        it('should have default params', () => {
            expect(mod.params.gain).toBe(0.8);
        });

        it('should create buffers', () => {
            expect(mod.outputs.out).toBeInstanceOf(Float32Array);
            expect(mod.outputs.out.length).toBe(512);
        });
    });

    describe('processing', () => {
        it('should not produce NaN', () => {
            mod.process();
            expect(mod.outputs.out.every(v => !isNaN(v))).toBe(true);
        });

        it('should stay within voltage range', () => {
            // Fill input with signal
            mod.inputs.audio.fill(5);
            mod.process();

            const max = Math.max(...mod.outputs.out);
            const min = Math.min(...mod.outputs.out);

            expect(max).toBeLessThanOrEqual(5);
            expect(min).toBeGreaterThanOrEqual(-5);
        });
    });
});
```

Run tests with:

```bash
npm test
```

## Tips

1. **Allocate buffers once** in `createDSP`, not in `process()`
2. **Use slew** for any CV that controls amplitude or frequency
3. **Clamp inputs** to prevent NaN and Infinity
4. **Update LEDs** in `process()` for real-time feedback
5. **Test edge cases**: zero inputs, maximum inputs, rapid parameter changes
6. **Follow voltage standards** for interoperability with other modules

## Debugging

Common issues:

| Problem | Cause | Fix |
|---------|-------|-----|
| NaN in output | Division by zero | Add guards: `x / (y \|\| 0.001)` |
| Clicks/pops | Sudden value changes | Use `createSlew()` |
| No sound | Wrong voltage range | Check ±5V for audio |
| Trigger not firing | Wrong threshold | Use the module's documented threshold, commonly `>= 1` for gates/triggers or `> 2.5` for clock/tap |
| DC offset | Unbalanced waveform | Center around 0V |
