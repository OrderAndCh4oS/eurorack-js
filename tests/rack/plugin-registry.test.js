import { describe, expect, it, vi } from 'vitest';
import { PluginRegistry } from '../../src/js/rack/registry.js';
import { normalizePatch } from '../../src/js/app/patch-format.js';

function createModule(id = 'test-module') {
    return {
        id,
        name: 'Test Module',
        hp: 2,
        color: 'module-color-one',
        category: 'utility',
        createDSP({ bufferSize = 4 } = {}) {
            return {
                params: {},
                inputs: { in: new Float32Array(bufferSize) },
                outputs: { out: new Float32Array(bufferSize) },
                process() {}
            };
        },
        ui: {
            inputs: [{ id: 'in', port: 'in', signal: 'any' }],
            outputs: [{ id: 'out', port: 'out', signal: 'any' }]
        }
    };
}

function manifest(id, definition = createModule()) {
    return {
        id,
        name: id,
        version: '1.0.0',
        apiVersion: 1,
        patchVersion: 1,
        workletUrl: `https://example.test/${id}.js`,
        modules: [{ id: definition.id, definition }]
    };
}

describe('PluginRegistry', () => {
    it('registers atomically, emits changes, and is idempotent for the same manifest', async () => {
        const registry = new PluginRegistry({ blockSize: 4 });
        const listener = vi.fn();
        registry.subscribe(listener);
        const plugin = manifest('test-plugin');

        const first = await registry.registerPlugin(plugin);
        const second = await registry.registerPlugin(plugin);

        expect(second).toBe(first);
        expect(registry.count).toBe(1);
        expect(registry.getPatchDependencies(['test-module'])).toEqual({ 'test-plugin': 1 });
        expect(listener).toHaveBeenCalledOnce();
    });

    it('rejects module collisions without partially registering the new plugin', async () => {
        const registry = new PluginRegistry({ blockSize: 4 });
        await registry.registerPlugin(manifest('first'));
        await expect(registry.registerPlugin(manifest('second'))).rejects.toThrow('already registered');
        expect(registry.getPlugin('second')).toBeNull();
        expect(registry.count).toBe(1);
    });

    it('rejects unregistering a plugin whose module type is active', async () => {
        const registry = new PluginRegistry({ blockSize: 4 });
        await registry.registerPlugin(manifest('test-plugin'));
        registry.addUsageResolver(() => ['test-module']);
        expect(() => registry.unregisterPlugin('test-plugin'))
            .toThrow('is in use');
    });

    it('runs a plugin patch migration before validating its current contract', async () => {
        const registry = new PluginRegistry({ blockSize: 4 });
        const migratePatch = vi.fn(state => ({
            ...state,
            params: { test_1: { level: state.params.test_1.gain } }
        }));
        const plugin = {
            ...manifest('test-plugin'),
            patchVersion: 2,
            migratePatch
        };
        await registry.registerPlugin(plugin);

        const migrated = normalizePatch({
            version: 3,
            plugins: { 'test-plugin': 1 },
            modules: [{ id: 'test_1', type: 'test-module', row: 1, index: 0 }],
            params: { test_1: { gain: 0.7 } },
            cables: [],
            midiMappings: {}
        }, { moduleRegistry: registry });

        expect(migratePatch).toHaveBeenCalledWith(expect.any(Object), { fromVersion: 1, toVersion: 2 });
        expect(migrated.plugins).toEqual({ 'test-plugin': 2 });
        expect(migrated.params.test_1).toEqual({ level: 0.7 });
    });
});
