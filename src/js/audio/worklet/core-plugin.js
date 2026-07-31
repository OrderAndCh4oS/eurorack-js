// Keep this revision aligned with worklet-engine.js and processor.js.
import { CORE_MODULE_DEFINITIONS } from '../../rack/core-definitions.js?core=20260731-3-c993e926';
import { registerWorkletPlugin } from './plugin-registry.js';

registerWorkletPlugin({
    id: 'core',
    apiVersion: 1,
    patchVersion: 1,
    modules: new Map(CORE_MODULE_DEFINITIONS.map(definition => [definition.id, definition]))
});
