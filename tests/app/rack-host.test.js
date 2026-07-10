import { describe, expect, it } from 'vitest';
import { RackHost } from '../../src/js/app/rack-host.js';
import { PluginRegistry } from '../../src/js/rack/registry.js';

function createModule(id) {
    return {
        id,
        name: id,
        hp: 2,
        color: 'module-color-one',
        category: 'utility',
        createDSP({ bufferSize = 4 } = {}) {
            return {
                params: {},
                inputs: { in: new Float32Array(bufferSize) },
                outputs: { out: new Float32Array(bufferSize) },
                leds: {},
                process() {}
            };
        },
        ui: {
            inputs: [{ id: 'in', port: 'in', signal: 'any' }],
            outputs: [{ id: 'out', port: 'out', signal: 'any' }]
        }
    };
}

async function createHost() {
    const registry = new PluginRegistry({ blockSize: 4 });
    await registry.registerPlugin({
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        apiVersion: 1,
        patchVersion: 2,
        workletUrl: 'https://example.test/worklet.js',
        modules: [
            { id: 'source', definition: createModule('source') },
            { id: 'sink', definition: createModule('sink') }
        ]
    });
    const host = new RackHost({ registry, blockSize: 4 });
    await host.init();
    return { host, registry };
}

describe('RackHost', () => {
    it('replaces an occupied input while preserving output fan-out', async () => {
        const { host } = await createHost();
        host.addModule('source', { id: 'source_1' });
        host.addModule('source', { id: 'source_2' });
        host.addModule('sink', { id: 'sink_1' });
        host.addModule('sink', { id: 'sink_2' });

        host.connect({ fromModule: 'source_1', fromPort: 'out', toModule: 'sink_1', toPort: 'in' });
        host.connect({ fromModule: 'source_1', fromPort: 'out', toModule: 'sink_2', toPort: 'in' });
        host.connect({ fromModule: 'source_2', fromPort: 'out', toModule: 'sink_1', toPort: 'in' });

        expect(host.state.cables).toEqual([
            { fromModule: 'source_1', fromPort: 'out', toModule: 'sink_2', toPort: 'in' },
            { fromModule: 'source_2', fromPort: 'out', toModule: 'sink_1', toPort: 'in' }
        ]);
        await host.destroy();
    });

    it('serializes plugin dependencies and runtime state separately', async () => {
        const { host } = await createHost();
        const module = host.addModule('source', { id: 'source_1' });
        module.runtimeState = { phase: 0.25 };

        expect(host.serializePatch()).toMatchObject({ version: 3, plugins: { 'test-plugin': 2 } });
        expect(host.serializePatch().modules[0]).not.toHaveProperty('runtimeState');
        expect(host.createRuntimePatchState().modules[0]).toMatchObject({ runtimeState: { phase: 0.25 } });
        await host.destroy();
    });

    it('keeps one UI mirror attached before, during, and after audio', async () => {
        const engine = {
            setPatchState: async () => 1,
            captureRuntimeStates: async () => ({}),
            start() {},
            stop() {}
        };
        const { host } = await createHost();
        host.audioEngineFactory = async () => engine;
        const module = host.addModule('source', { id: 'source_1' });
        const mirror = module.instance;

        expect(mirror).toBeTruthy();
        await host.startAudio({ sampleRate: 48000 });
        expect(module.instance).toBe(mirror);
        host.applyTelemetry({ source_1: { params: {}, leds: { active: 1 } } });
        expect(module.instance.leds.active).toBe(1);

        await host.stopAudio();
        expect(module.instance).toBe(mirror);
        await host.destroy();
    });

    it('prevents unloading a plugin used by the live rack', async () => {
        const { host, registry } = await createHost();
        host.addModule('source', { id: 'source_1' });

        expect(() => registry.unregisterPlugin('test-plugin')).toThrow('is in use');
        host.removeModule('source_1');
        expect(registry.unregisterPlugin('test-plugin')).toBe(true);
        await host.destroy();
    });

    it('rejects an invalid patch without changing the current rack', async () => {
        const { host } = await createHost();
        host.addModule('source', { id: 'source_1' });
        const before = host.serializePatch();

        await expect(host.loadPatch({
            version: 3,
            plugins: { missing: 1 },
            modules: [],
            params: {},
            cables: [],
            midiMappings: {}
        })).rejects.toThrow('missing plugin');
        expect(host.serializePatch()).toEqual(before);
        await host.destroy();
    });
});
