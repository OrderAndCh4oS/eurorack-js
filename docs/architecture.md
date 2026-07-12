# Codebase Architecture and Schemas

eurorack-js is a browser-based modular synthesizer. Modules exchange voltage buffers, but only modules marked as audio outputs send sound to Web Audio. The codebase separates rack ownership, browser UI, and real-time DSP. A module keeps its DSP and UI definition together, but the definition is instantiated differently on the main thread and in the audio worklet.

## Mental Model

```text
EurorackApp (DOM and user interaction)
└── RackHost (authoritative runtime API)
    ├── RackState (modules, rows, params, cables, MIDI mappings)
    ├── PluginRegistry (trusted plugin and module definitions)
    ├── UI mirrors (stable main-thread instances for custom renderers)
    └── AudioWorkletEngine
        └── EurorackProcessor (audio thread)
            ├── Worklet plugin registry
            ├── DSP instances
            └── Compiled signal graph
```

`RackHost` is the only production owner of module lifecycle, parameters, patch loading, cables, runtime state, and audio activation. `EurorackApp` renders DOM and delegates mutations to the host. The old `createRack()` and `setupRack()` public runtime no longer exist.

Audio requires `AudioWorklet` in a secure context. There is no ScriptProcessor, timer-based fallback, or duplicate main-thread DSP engine.

### From Patch to Sound

1. `EurorackApp` turns DOM, cable, patch, and MIDI interactions into host commands.
2. `RackHost` mutates `RackState`, validates plugin ownership, and sends a versioned topology to `AudioWorkletEngine`.
3. `EurorackProcessor` creates the worklet DSP instances and compiles cable routes with `compileGraph()`.
4. Each audio block copies source voltages into stable destination buffers and processes modules in dependency order.
5. Modules marked `role: 'audio-output'` are summed into the browser's stereo output.
6. Bounded telemetry returns LEDs and display state to stable main-thread UI mirrors.

Patch activation is atomic: the host waits for the worklet to acknowledge the requested topology revision. A compilation failure leaves the previous audio graph active.

## Module Instances

Each live rack module has two instances:

- **UI mirror**: created on the main thread as soon as the module enters `RackState`. Its identity remains stable before, during, and after audio playback. Custom renderers capture this instance.
- **DSP instance**: created inside `EurorackProcessor`. It alone processes routed voltage buffers and produces sound.

Parameter changes are validated against the module's declared UI parameter paths, written to `RackState`, reflected in the UI mirror, and sent to the worklet. The processor repeats validation before mutation. The worklet sends bounded telemetry back at approximately 30 Hz. A UI mirror is not a second production DSP path and must never be processed by the browser app.

## Plugin Registration

Plugins are trusted JavaScript, not sandboxed extensions. Registration is atomic: all definitions validate before any module becomes visible. Plugin IDs and module IDs cannot collide.

The main-thread manifest is:

```javascript
{
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    apiVersion: 1,
    patchVersion: 1,
    workletUrl: new URL('./my-plugin.worklet.js', import.meta.url).href,
    modules: [{ id: 'mymodule', definition: myModule }]
}
```

Register it with `registerPlugin(manifest)`. A plugin cannot be unregistered while a live `RackHost` contains one of its module types.

The worklet URL is loaded only when an active patch declares that plugin. It must register matching ownership and patch contracts:

```javascript
globalThis.registerEurorackWorkletPlugin({
    id: 'my-plugin',
    apiVersion: 1,
    patchVersion: 1,
    modules: new Map([['mymodule', myModule]])
});
```

The processor rejects a topology when its plugin is missing, its patch contract differs, or a module resolves to a different owner.

Core modules have two registration lists because worklets require static imports:

- `rack/module-manifest.js`: lazy main-thread imports and deterministic default order.
- `rack/core-definitions.js`: static worklet imports in the same order.

Contract tests require both lists to match exactly.

## Module Schema

Every module definition includes metadata, `createDSP()`, a declarative `ui` contract, and optionally `render`, `telemetry`, runtime-state hooks, and a worklet-event handler.

```javascript
export default {
    id: 'mymodule',
    name: 'My Module',
    hp: 4,
    color: 'module-color-six',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512, services = {} } = {}) {
        const input = new Float32Array(bufferSize);
        const output = new Float32Array(bufferSize);
        return {
            params: { gain: 0.5 },
            inputs: { input },
            outputs: { output },
            leds: { active: 0 },
            process() {},
            reset() {}
        };
    },

    ui: {
        knobs: [{ id: 'gain', label: 'Gain', param: 'gain', min: 0, max: 1, default: 0.5 }],
        inputs: [{
            id: 'input', label: 'In', port: 'input', signal: 'audio',
            voltage: { min: -5, max: 5, normal: 0 }
        }],
        outputs: [{ id: 'output', label: 'Out', port: 'output', signal: 'audio' }]
    }
};
```

### Port Contract

`signal` is one of `audio`, `cv`, `gate`, `trigger`, or `any`. It is semantic metadata for validation, rendering, and tooling; Eurorack remains DC-coupled, so differing signal labels do not prohibit a cable.

Default voltage contracts are:

| Signal | Minimum | Maximum | Input normal |
|---|---:|---:|---:|
| `audio` | -5V | 5V | 0V |
| `cv` | -5V | 5V | 0V |
| `gate` | 0V | 10V | 0V |
| `trigger` | 0V | 10V | 0V |
| `any` | -10V | 10V | 0V |

Use `voltage` to override known hardware behavior. The DSP input buffer must initialize to its declared `normal`. Input and output `Float32Array` identities are immutable for the DSP lifetime. Routing copies samples into input buffers; modules must not replace them or implement cable cleanup methods.

### Custom Renderer Telemetry

A module with `render()` must declare what additional UI state crosses from its worklet DSP to the stable UI mirror:

```javascript
telemetry: {
    fields: ['displayBuffer'],
    methods: ['getStats'],
    history: { field: 'history', maxEntries: 300 }
}
```

- `params` and `leds` are always synchronized.
- `fields` are structured-cloned snapshots and must stay bounded.
- `methods` are evaluated in the worklet; the mirror exposes a zero-argument function returning the latest result.
- `history` sends only new entries and maintains a bounded mirror-side history.

Custom controls must call `onParamChange()`. Writing directly to `instance.dsp` only changes the mirror and cannot control audio. Display code may read the mirror, but must tolerate telemetry latency.

### Worklet Module Events

DSP code cannot access DOM APIs. A DSP can expose `drainEvents()` to return infrequent, structured-cloneable events. The processor forwards them as `module-event` messages and transfers included typed-array buffers. A definition may handle them on the main thread:

```javascript
handleWorkletEvent(event, { moduleId, instance }) {
    // Browser-only work such as file export.
}
```

This path is for command-boundary data such as completed recordings, not continuous telemetry.

The core recorder stores one-second stereo chunks and emits `recording-complete` with `buffersL`, `buffersR`, `sampleRate`, and the exact valid `sampleCount`. The final chunk may be padded; main-thread WAV encoding must stop at `sampleCount`.

### MIDI Timing

Raw MIDI messages cross to the worklet with an AudioContext timestamp. At the start of each render quantum, the MIDI service exposes non-destructive note and clock/transport event arrays containing `sampleOffset`. Every MIDI module sees the same block events; late events use offset zero and future events remain queued. CC, mod wheel, and pitch bend are block-rate state. DSP modules receive this service through `createDSP({ services })` and must not read browser globals.

### Worklet Profiling

`AudioWorkletEngine.setProfiling(enabled, { reset })` enables bounded, opt-in timing capture. `requestProfilingReport()` returns render deadline plus block and per-module p50/p95/p99 milliseconds and p99 utilization. Profiling is disabled by default and its machine-dependent values are diagnostic, not CI pass/fail thresholds.

## Compiled Signal Graph

Topology activation validates every module, endpoint, direction, and block buffer before replacing the active graph. The worklet acknowledges the topology revision; `RackHost.loadPatch()` does not commit until that revision is active.

Routing rules:

- One source per input. Creating a new cable to an occupied input replaces the prior cable.
- One output may fan out to any number of inputs.
- Imported patches with duplicate destinations are rejected rather than silently rewritten.
- Sources process before destinations using a topological ordering.
- Manifest order, rack order, then instance ID provide deterministic tie breaks.
- Every edge inside a feedback strongly connected component uses an explicit one-block delay, including self-feedback.
- Removing a cable immediately restores the destination's declared normal voltage.
- Cable endpoint moves are transactional: clicks, Escape, focus loss, and incompatible-jack drops restore the original connection; a valid drop commits the move, while an actual drag to empty space explicitly removes it.

If a module throws during `process()`, that instance is disabled and its outputs are zeroed while the rest of the graph continues. Topology compilation errors reject the revision and leave the prior graph active.

## Patch Schema v3

Canonical patch state is:

```javascript
{
    version: 3,
    plugins: { core: 1, 'my-plugin': 2 },
    modules: [
        { id: 'osc_1', type: 'vco', row: 1, index: 0 }
    ],
    params: {
        osc_1: { coarse: 0.35 }
    },
    cables: [
        { fromModule: 'osc_1', fromPort: 'triangle', toModule: 'out_1', toPort: 'L' }
    ],
    midiMappings: {}
}
```

`plugins` maps plugin IDs to their patch contract versions, not package versions. Every module type must belong to a declared plugin. Missing plugins reject the whole patch; placeholder modules are not created.

Only schema version 3 is accepted. Every parameter group must name an existing module, every parameter path must be declared by that module's UI contract, and numeric leaves must be finite. Plugin patch contracts must match exactly; the application does not migrate older patch or plugin schemas.

Runtime state such as looper buffers is separate from persisted patch state. `RackHost` captures supported runtime state when audio stops and includes it only in the next worklet topology.

Topology acknowledgements and runtime-state requests have a five-second timeout. Processor failure or shutdown rejects and clears all pending requests. Runtime-state capture failure is reported but cannot prevent audio shutdown.

## MIDI and Output

Raw MIDI messages are forwarded to the worklet, where the shared MIDI service exposes note, clock, CC, pitch-bend, and modulation state to modules.

Modules marked `role: 'audio-output'` are worklet sinks. Their stereo inputs are summed into the single browser output, scaled from Eurorack ±5V to Web Audio ±1. Main-thread UI mirrors never create or connect audio nodes.

## Repository Map

| Area | Responsibility |
|---|---|
| `src/js/app/app.js` | DOM orchestration, cable interaction, patch controls, MIDI setup, and audio start/stop UI |
| `src/midi-*.html`, `src/midi-tools.css` | Standalone MIDI performance tools sharing the app's saved theme and light/dark mode |
| `src/js/app/rack-host.js` | Authoritative module, parameter, cable, patch, runtime-state, and audio lifecycle API |
| `src/js/app/rack-state.js` | Serializable modules, rows, params, cables, and MIDI mappings |
| `src/js/app/patch-format.js` | Strict patch v3, dependency, parameter, and endpoint validation |
| `src/js/rack/registry.js` | Atomic trusted-plugin registration and module ownership |
| `src/js/rack/module-contract.js` | Module, port, buffer, voltage, and telemetry validation |
| `src/js/rack/module-manifest.js` | Lazy core imports, category taxonomy, and deterministic module order |
| `src/js/rack/core-definitions.js` | Static core imports used by the AudioWorklet bundle |
| `src/js/audio/worklet-engine.js` | Main-thread AudioWorklet node and message controller |
| `src/js/audio/worklet/processor.js` | Production DSP loop, output summing, telemetry, MIDI, and module events |
| `src/js/audio/graph.js` | Compiled routing, dependency order, input normals, and feedback delays |
| `src/js/modules/{moduleId}/index.js` | Self-contained module DSP, UI contract, renderer, and optional telemetry/hooks |
| `src/js/ui/renderer.js` | Declarative and custom module DOM rendering |
| `src/js/ui/toolkit/` | Shared controls, layout helpers, and interactions |
| `src/js/utils/math.js` | Clamp and exponential parameter mapping with explicit range contracts |
| `src/js/utils/oscillator.js` | Optional normalized phase wrapping and PolyBLEP primitives |
| `src/js/utils/interpolation.js` | Optional linear and fixed circular-buffer interpolation primitives |
| `src/js/utils/slew.js` | Optional stateful RC smoothing primitive |
| `src/js/utils/voltage.js` | Optional documented soft voltage rails |
| `src/js/utils/fft.js` | Optional preallocated, calibrated real FFT analysis |
| `src/js/utils/color.js` | Internal theme-token and fallback color handling |
| `src/js/utils/nested-access.js` | Internal validated parameter/port path access with stable-buffer copying |
| `src/js/config/patches/` | Individual factory patch definitions |
| `src/js/config/patches/index.js` | Factory patch aggregation and display ordering |
| `src/js/index.js` | Public host, plugin, contract, renderer, toolkit, and utility exports |
| `tests/dsp/` | Focused module behavior and voltage-contract tests |
| `tests/audio/` | Graph and AudioWorklet integration tests |

## Where to Make Changes

- **Add a built-in module**: create `modules/{moduleId}/index.js`, then register it in both `module-manifest.js` and `core-definitions.js` in matching order.
- **Add an external plugin**: register its main-thread manifest and provide a matching worklet entry point; do not edit core registration lists.
- **Change cable or feedback behavior**: edit `audio/graph.js` and its graph/worklet tests.
- **Change production block processing**: edit `audio/worklet/processor.js`.
- **Change rack ownership or lifecycle**: edit `app/rack-host.js`.
- **Change the patch schema or persistence**: edit `app/patch-format.js`, app import/export handling, and patch tests together.
- **Change module panels**: edit the module's `ui`/`render` definition and shared renderer/toolkit only when the behavior is reusable.
- **Add a DSP primitive**: add a focused utility with boundary tests, migrate only behaviorally equivalent call sites, export module-facing APIs from `src/js/index.js`, and update the module creation guide.
- **Add a factory patch**: add one file under `config/patches/` and register it in that directory's `index.js`.
- **Change the public API**: edit `src/js/index.js` and update the architecture/module-authoring documentation.
