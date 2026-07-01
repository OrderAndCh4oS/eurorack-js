import { describe, it, expect, beforeEach } from 'vitest';
import loopModule from '../../src/js/modules/loop/index.js';

const createLoop = (options = {}) => loopModule.createDSP({
    sampleRate: 100,
    bufferSize: 4,
    ...options
});

function recordSamples(loop, samples) {
    loop.params.record = 1;
    loop.inputs.in.set(samples);
    loop.process();
    loop.params.record = 0;
    loop.inputs.in.fill(0);
    loop.process();
}

function expectArrayClose(actual, expected, precision = 5) {
    expect(actual.length).toBe(expected.length);
    actual.forEach((value, index) => {
        expect(value).toBeCloseTo(expected[index], precision);
    });
}

describe('LOOP - Minimal Looper', () => {
    let loop;

    beforeEach(() => {
        loop = createLoop();
    });

    describe('initialization', () => {
        it('creates default params, buffers, outputs, and leds', () => {
            expect(loopModule.hp).toBe(6);
            expect(loop.params.mode).toBe(0);
            expect(loop.params.record).toBe(0);
            expect(loop.params.reverse).toBe(0);
            expect(loop.params.halfSpeed).toBe(0);
            expect(loop.params.level).toBe(0.8);
            expect(loop.params.length).toBe(1);
            expect(loop.params.mix).toBe(1);
            expect(loop.inputs.in).toBeInstanceOf(Float32Array);
            expect(loop.inputs.recTrig).toBeInstanceOf(Float32Array);
            expect(loop.inputs.reverseTrig).toBeInstanceOf(Float32Array);
            expect(loop.outputs.out).toBeInstanceOf(Float32Array);
            expect(loop.outputs.out.length).toBe(4);
            expect(loop.leds.recording).toBe(0);
            expect(loop.leds.playing).toBe(0);
            expect(loop.leds.hasLoop).toBe(0);
        });

        it('sizes internal storage from runtime sample rate', () => {
            const custom = createLoop({ sampleRate: 50, bufferSize: 8 });
            expect(custom.outputs.out.length).toBe(8);
            expect(custom.getLoopInfo().maxSamples).toBe(50 * 60);
        });
    });

    describe('recording and playback', () => {
        it('outputs silence before a loop exists', () => {
            loop.inputs.in.fill(3);
            loop.process();
            expect([...loop.outputs.out]).toEqual([0, 0, 0, 0]);
        });

        it('passes dry input before a loop exists when mix is dry', () => {
            loop.params.mix = 0;
            loop.inputs.in.fill(3);
            loop.process();
            expectArrayClose([...loop.outputs.out], [2.4, 2.4, 2.4, 2.4]);
        });

        it('captures first recording pass as loop length', () => {
            loop.params.record = 1;
            loop.inputs.in.set([1, 2, 3, 4]);
            loop.process();

            expect(loop.getLoopInfo().recording).toBe(true);
            expect(loop.getLoopInfo().recordHead).toBe(4);
            expectArrayClose([...loop.outputs.out], [0.8, 1.6, 2.4, 3.2]);

            loop.params.record = 0;
            loop.inputs.in.fill(0);
            loop.process();

            expect(loop.getLoopInfo().hasLoop).toBe(true);
            expect(loop.getLoopInfo().loopLength).toBe(4);
            expect(loop.leds.hasLoop).toBe(1);
        });

        it('uses length knob as first-pass recording limit', () => {
            loop.params.length = 4 / loop.getLoopInfo().maxSamples;
            loop.params.record = 1;
            loop.inputs.in.set([1, 2, 3, 4]);
            loop.process();

            expect(loop.getLoopInfo().hasLoop).toBe(true);
            expect(loop.getLoopInfo().loopLength).toBe(4);
            expect(loop.getLoopInfo().recording).toBe(false);
            expect(loop.params.record).toBe(0);
        });

        it('records nothing when length knob is 0%', () => {
            loop.params.length = 0;
            loop.params.record = 1;
            loop.inputs.in.set([1, 2, 3, 4]);
            loop.process();

            expect(loop.getLoopInfo().hasLoop).toBe(false);
            expect(loop.getLoopInfo().loopLength).toBe(0);
            expect(loop.getLoopInfo().recording).toBe(false);
            expect(loop.params.record).toBe(0);
            expect([...loop.outputs.out]).toEqual([0, 0, 0, 0]);
        });

        it('plays back recorded samples at normal speed', () => {
            recordSamples(loop, [1, 2, 3, 4]);

            loop.process();

            expectArrayClose([...loop.outputs.out], [0.8, 1.6, 2.4, 3.2]);
        });

        it('blends dry input with loop playback using mix knob', () => {
            recordSamples(loop, [2, 2, 2, 2]);
            loop.params.level = 1;
            loop.params.mix = 0.5;
            loop.inputs.in.fill(4);
            loop.process();

            expectArrayClose([...loop.outputs.out], [3, 3, 3, 3]);
        });

        it('plays back at half speed with interpolation', () => {
            loop.params.halfSpeed = 1;
            recordSamples(loop, [0, 4, 0, -4]);

            expectArrayClose([...loop.outputs.out], [0, 1.6, 3.2, 1.6]);
            expect([...loop.outputs.out].every(Number.isFinite)).toBe(true);
        });

        it('plays back in reverse without invalid samples', () => {
            loop.params.reverse = 1;
            recordSamples(loop, [1, 2, 3, 4]);

            expectArrayClose([...loop.outputs.out], [0.8, 3.2, 2.4, 1.6]);
            expect([...loop.outputs.out].every(Number.isFinite)).toBe(true);
        });
    });

    describe('record modes', () => {
        function overwriteWithMode(mode) {
            recordSamples(loop, [1, 1, 1, 1]);
            loop.params.mode = mode;
            loop.params.record = 1;
            loop.inputs.in.fill(1);
            loop.process();
            return loop.getBufferSample(0);
        }

        it('sound-on-sound layers input over existing loop', () => {
            expect(overwriteWithMode(0)).toBeCloseTo(1.8, 5);
        });

        it('dub mode decays old loop while adding input', () => {
            expect(overwriteWithMode(1)).toBeCloseTo(1.75, 5);
        });

        it('replace mode overwrites old loop content', () => {
            expect(overwriteWithMode(2)).toBeCloseTo(1, 5);
        });

        it('infinite mode preserves most old loop content', () => {
            expect(overwriteWithMode(3)).toBeCloseTo(1.67, 5);
        });
    });

    describe('triggers and reset', () => {
        it('toggles recording from rec trigger rising edges', () => {
            loop.inputs.in.fill(2);
            loop.inputs.recTrig[0] = 5;
            loop.process();

            expect(loop.params.record).toBe(1);
            expect(loop.getLoopInfo().recording).toBe(true);

            loop.inputs.recTrig.fill(0);
            loop.process();
            loop.inputs.recTrig[0] = 5;
            loop.process();

            expect(loop.params.record).toBe(0);
            expect(loop.getLoopInfo().hasLoop).toBe(true);
        });

        it('toggles reverse from reverse trigger rising edges', () => {
            loop.inputs.reverseTrig[0] = 5;
            loop.process();
            expect(loop.params.reverse).toBe(1);

            loop.inputs.reverseTrig.fill(0);
            loop.process();
            loop.inputs.reverseTrig[0] = 5;
            loop.process();
            expect(loop.params.reverse).toBe(0);
        });

        it('clears loop state with clear param', () => {
            recordSamples(loop, [1, 2, 3, 4]);
            expect(loop.getLoopInfo().hasLoop).toBe(true);

            loop.params.clear = 1;
            loop.process();

            expect(loop.getLoopInfo().hasLoop).toBe(false);
            expect(loop.getLoopInfo().loopLength).toBe(0);
            expect(loop.params.clear).toBe(0);
            expect([...loop.outputs.out]).toEqual([0, 0, 0, 0]);
        });

        it('reset preserves captured loop and resets transport only', () => {
            recordSamples(loop, [1, 2, 3, 4]);
            loop.params.reverse = 1;
            loop.params.halfSpeed = 1;
            loop.reset();

            expect(loop.getLoopInfo().hasLoop).toBe(true);
            expect(loop.getLoopInfo().loopLength).toBe(4);
            expect(loop.getLoopInfo().playHead).toBe(0);
            expect(loop.params.record).toBe(0);
            expect(loop.params.reverse).toBe(1);
            expect(loop.params.halfSpeed).toBe(1);
            expect(loop.leds.recording).toBe(0);
            expect(loop.leds.playing).toBe(1);
            expect(loop.leds.hasLoop).toBe(1);
        });

        it('captures and restores runtime loop state', () => {
            recordSamples(loop, [1, 2, 3, 4]);
            loop.process();

            const runtimeState = loopModule.captureRuntimeState(loop);
            const restored = createLoop();
            loopModule.restoreRuntimeState(restored, runtimeState);

            expect(restored.getLoopInfo().hasLoop).toBe(true);
            expect(restored.getLoopInfo().loopLength).toBe(4);
            expect(restored.getBufferSample(0)).toBeCloseTo(1, 5);
            expect(restored.getBufferSample(3)).toBeCloseTo(4, 5);

            restored.process();
            expectArrayClose([...restored.outputs.out], [0.8, 1.6, 2.4, 3.2]);
        });
    });
});
