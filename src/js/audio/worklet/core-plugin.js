import { CORE_MODULE_DEFINITIONS } from '../../rack/core-definitions.js';
import { registerWorkletPlugin } from './plugin-registry.js';

registerWorkletPlugin({
    id: 'core',
    apiVersion: 1,
    patchVersion: 1,
    modules: new Map(CORE_MODULE_DEFINITIONS.map(definition => [definition.id, definition]))
});
