// Keep this revision aligned with worklet-engine.js and processor.js.
import { CORE_MODULE_DEFINITIONS } from '../../rack/core-definitions.js?core=20261117-8-b8441822';
import { registerWorkletPlugin } from './plugin-registry.js';
import { prepareCoreModules } from './prepare-modules.js';

// Prepare immutable DSP resources before the AudioWorkletNode exists. Adding
// an instance to a live rack then reuses the bank without expensive priming.
prepareCoreModules(CORE_MODULE_DEFINITIONS, globalThis.sampleRate);

registerWorkletPlugin({
    id: 'core',
    apiVersion: 1,
    patchVersion: 1,
    modules: new Map(CORE_MODULE_DEFINITIONS.map(definition => [definition.id, definition]))
});
