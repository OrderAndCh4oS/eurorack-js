import { describe, expect, it, vi } from 'vitest';
import { PluginRegistry } from '../../src/js/rack/registry.js';

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

    it('requires module color tokens', async () => {
        const registry = new PluginRegistry({ blockSize: 4 });
        const definition = { ...createModule(), color: '#555555' };
        await expect(registry.registerPlugin(manifest('test-plugin', definition)))
            .rejects.toThrow('invalid color');
    });

    it('rejects plugin patch migration hooks', async () => {
        const registry = new PluginRegistry({ blockSize: 4 });
        await expect(registry.registerPlugin({ ...manifest('test-plugin'), migratePatch() {} }))
            .rejects.toThrow('patch migrations are not supported');
    });

    it('rejects unregistering a plugin whose module type is active', async () => {
        const registry = new PluginRegistry({ blockSize: 4 });
        await registry.registerPlugin(manifest('test-plugin'));
        registry.addUsageResolver(() => ['test-module']);
        expect(() => registry.unregisterPlugin('test-plugin'))
            .toThrow('is in use');
    });

});
