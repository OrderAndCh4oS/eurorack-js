import { describe, it, expect, beforeAll } from 'vitest';
import { EurorackApp } from '../../src/js/app/app.js';
import { loadCorePlugin, moduleRegistry } from '../../src/js/rack/registry.js';
import loopModule from '../../src/js/modules/loop/index.js';

function recordSamples(loop, samples) {
    loop.params.record = 1;
    loop.inputs.in.set(samples);
    loop.process();
    loop.params.record = 0;
    loop.inputs.in.fill(0);
    loop.process();
}

describe('EurorackApp runtime module state', () => {
    beforeAll(async () => {
        await loadCorePlugin();
    });

    it('restores module runtime state when recreating DSP instances', () => {
        const source = loopModule.createDSP({ sampleRate: 44100, bufferSize: 4 });
        recordSamples(source, [1, 2, 3, 4]);

        const app = new EurorackApp(document);
        const moduleState = app.state.addModule('loop', moduleRegistry, { id: 'loop_1' });
        moduleState.runtimeState = loopModule.captureRuntimeState(source);

        const restored = app.createDSP(moduleState);

        expect(restored.getLoopInfo().hasLoop).toBe(true);
        expect(restored.getLoopInfo().loopLength).toBe(4);
        expect(restored.getBufferSample(0)).toBeCloseTo(1, 5);
        expect(restored.getBufferSample(3)).toBeCloseTo(4, 5);
    });
});
