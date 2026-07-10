# Runtime Architecture and Schemas

eurorack-js separates rack ownership, browser UI, and real-time DSP. Modules still keep DSP and UI definitions together, but the same definition is instantiated differently on the main thread and in the audio worklet.

## Runtime Ownership

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

Audio requires `AudioWorklet` in a secure context. There is no ScriptProcessor or timer-based production fallback. The main-thread engine remains a test/reference implementation, not an application audio path.

## Module Instances

Each live rack module has two instances:

- **UI mirror**: created on the main thread as soon as the module enters `RackState`. Its identity remains stable before, during, and after audio playback. Custom renderers capture this instance.
- **DSP instance**: created inside `EurorackProcessor`. It alone processes routed voltage buffers and produces sound.

Parameter changes are written to `RackState`, reflected in the UI mirror, and sent to the worklet. The worklet sends bounded telemetry back at approximately 30 Hz. A UI mirror is not a second production DSP path and must never be processed by the browser app.

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
    modules: [{ id: 'mymodule', definition: myModule }],
    migratePatch(state, { fromVersion, toVersion }) { return state; } // optional
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

Canonical v2 state receives a one-time v3 migration that infers plugin dependencies from installed module ownership. Legacy shapes containing `instanceId`, `knobs`, `switches`, or `buttons` are rejected. Plugin-specific patch migrations run before current-contract validation.

Runtime state such as looper buffers is separate from persisted patch state. `RackHost` captures supported runtime state when audio stops and includes it only in the next worklet topology.

## MIDI and Output

Raw MIDI messages are forwarded to the worklet, where the shared MIDI service exposes note, clock, CC, pitch-bend, and modulation state to modules.

Modules marked `role: 'audio-output'` are worklet sinks. Their stereo inputs are summed into the single browser output, scaled from Eurorack ±5V to Web Audio ±1. Main-thread UI mirrors never create or connect audio nodes.
