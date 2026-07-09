import { describe, it, expect, beforeEach } from 'vitest';
import joystickModule from '../../src/js/modules/joystick/index.js';

const SAMPLE_RATE = 1000;
const BUFFER_SIZE = 32;

const createJoystick = (options = {}) => joystickModule.createDSP({
    sampleRate: SAMPLE_RATE,
    bufferSize: BUFFER_SIZE,
    ...options
});

function processBlocks(dsp, blocks = 1) {
    for (let i = 0; i < blocks; i++) {
        dsp.process();
    }
}

function last(buffer) {
    return buffer[buffer.length - 1];
}

function expectFiniteBuffer(buffer) {
    Array.from(buffer).forEach(value => {
        expect(Number.isFinite(value)).toBe(true);
    });
}

function expectBufferInRange(buffer, min, max) {
    Array.from(buffer).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThanOrEqual(max);
    });
}

function triggerHighCount(buffer) {
    return Array.from(buffer).filter(value => value === 10).length;
}

function createRecordedJoystick() {
    const dsp = createJoystick({ sampleRate: 500, bufferSize: 4 });
    dsp.params.sense = 1;
    dsp.params.record = 1;

    dsp.params.x = -1;
    dsp.params.y = -1;
    dsp.params.gateButton = 1;
    dsp.process();

    dsp.params.x = 1;
    dsp.params.y = 1;
    dsp.params.gateButton = 0;
    dsp.process();

    dsp.params.record = 0;
    dsp.process();
    return dsp;
}

describe('JOY - Joystick Controller', () => {
    let joystick;

    beforeEach(() => {
        joystick = createJoystick();
    });

    describe('initialization', () => {
        it('defines the documented module metadata', () => {
            expect(joystickModule.id).toBe('joystick');
            expect(joystickModule.name).toBe('JOY');
            expect(joystickModule.hp).toBe(10);
            expect(joystickModule.category).toBe('utility');
            expect(joystickModule.color).toBe('module-color-six');
        });

        it('creates all params, ports, outputs, LEDs, and empty recorder state', () => {
            expect(joystick.params).toEqual({
                x: 0,
                y: 0,
                range: 0,
                cvMode: 0,
                cv1Amt: 0.5,
                cv2Amt: 0.5,
                sense: 1,
                gateButton: 0,
                record: 0,
                play: 0,
                loopMode: 1
            });

            ['cv1', 'cv2', 'trigger', 'reset'].forEach(port => {
                expect(joystick.inputs[port]).toBeInstanceOf(Float32Array);
                expect(joystick.inputs[port].length).toBe(BUFFER_SIZE);
            });
            ['x', 'y', 'a', 'b', 'c', 'd', 'gate', 'trig'].forEach(port => {
                expect(joystick.outputs[port]).toBeInstanceOf(Float32Array);
                expect(joystick.outputs[port].length).toBe(BUFFER_SIZE);
            });
            [
                'xPositive', 'xNegative', 'yPositive', 'yNegative',
                'a', 'b', 'c', 'd',
                'gate', 'record', 'play', 'trigger'
            ].forEach(id => {
                expect(joystick.leds).toHaveProperty(id, 0);
            });

            expect(joystick.getGestureInfo()).toMatchObject({
                hasRecording: false,
                recording: false,
                playing: false,
                length: 0
            });
        });
    });

    describe('voltage ranges and quadrant outputs', () => {
        it('defaults to centered bipolar X/Y and equal quadrant weights', () => {
            joystick.process();

            expect([...joystick.outputs.x]).toEqual(Array(BUFFER_SIZE).fill(0));
            expect([...joystick.outputs.y]).toEqual(Array(BUFFER_SIZE).fill(0));
            ['a', 'b', 'c', 'd'].forEach(port => {
                expect([...joystick.outputs[port]]).toEqual(Array(BUFFER_SIZE).fill(2.5));
            });
        });

        it('maps centered X/Y to 5V in unipolar range', () => {
            joystick.params.range = 1;
            joystick.process();

            expect([...joystick.outputs.x]).toEqual(Array(BUFFER_SIZE).fill(5));
            expect([...joystick.outputs.y]).toEqual(Array(BUFFER_SIZE).fill(5));
        });

        it('maps X/Y extremes to bipolar, unipolar, and A-D corner voltages', () => {
            joystick.params.x = 1;
            joystick.params.y = 1;
            processBlocks(joystick, 2);

            expect(last(joystick.outputs.x)).toBeCloseTo(5, 4);
            expect(last(joystick.outputs.y)).toBeCloseTo(5, 4);
            expect(last(joystick.outputs.a)).toBeCloseTo(0, 4);
            expect(last(joystick.outputs.b)).toBeCloseTo(10, 4);
            expect(last(joystick.outputs.c)).toBeCloseTo(0, 4);
            expect(last(joystick.outputs.d)).toBeCloseTo(0, 4);

            joystick.params.range = 1;
            processBlocks(joystick, 1);
            expect(last(joystick.outputs.x)).toBeCloseTo(10, 4);
            expect(last(joystick.outputs.y)).toBeCloseTo(10, 4);
        });

        it('keeps all output buffers finite and inside their voltage contracts', () => {
            joystick.params.x = 3;
            joystick.params.y = -3;
            joystick.params.range = 1;
            joystick.params.cvMode = 1;
            joystick.params.cv1Amt = 1;
            joystick.params.cv2Amt = 1;
            joystick.inputs.cv1.fill(20);
            joystick.inputs.cv2.fill(20);
            processBlocks(joystick, 2);

            ['x', 'y', 'a', 'b', 'c', 'd', 'gate', 'trig'].forEach(port => {
                expectFiniteBuffer(joystick.outputs[port]);
            });
            expectBufferInRange(joystick.outputs.x, 0, 10);
            expectBufferInRange(joystick.outputs.y, 0, 10);
            ['a', 'b', 'c', 'd'].forEach(port => expectBufferInRange(joystick.outputs[port], 0, 10));
            Array.from(joystick.outputs.gate).forEach(value => expect([0, 10]).toContain(value));
            Array.from(joystick.outputs.trig).forEach(value => expect([0, 10]).toContain(value));
        });
    });

    describe('parameter clamping', () => {
        it('clamps every documented parameter during processing', () => {
            const recorded = createRecordedJoystick();

            recorded.params.x = 2;
            recorded.params.y = -2;
            recorded.params.range = 4;
            recorded.params.cvMode = 9;
            recorded.params.cv1Amt = -1;
            recorded.params.cv2Amt = 2;
            recorded.params.sense = -1;
            recorded.params.gateButton = 3;
            recorded.params.record = 0;
            recorded.params.play = 3;
            recorded.params.loopMode = 7;
            recorded.process();

            expect(recorded.params.x).toBe(1);
            expect(recorded.params.y).toBe(-1);
            expect(recorded.params.range).toBe(1);
            expect(recorded.params.cvMode).toBe(2);
            expect(recorded.params.cv1Amt).toBe(0);
            expect(recorded.params.cv2Amt).toBe(1);
            expect(recorded.params.sense).toBe(0);
            expect(recorded.params.gateButton).toBe(1);
            expect(recorded.params.loopMode).toBe(2);
            expect([0, 1]).toContain(recorded.params.play);
        });
    });

    describe('CV automation modes', () => {
        it('uses cartesian CV inputs with attenuverter polarity and output clamping', () => {
            joystick.params.cvMode = 0;
            joystick.params.cv1Amt = 1;
            joystick.params.cv2Amt = 0;
            joystick.inputs.cv1.fill(5);
            joystick.inputs.cv2.fill(5);
            processBlocks(joystick, 2);

            expect(last(joystick.outputs.x)).toBeCloseTo(5, 4);
            expect(last(joystick.outputs.y)).toBeCloseTo(-5, 4);
            expect(last(joystick.outputs.b)).toBeCloseTo(0, 4);
            expect(last(joystick.outputs.c)).toBeCloseTo(10, 4);
        });

        it('uses polar CV as rotation and radius without producing invalid samples', () => {
            joystick.params.cvMode = 1;
            joystick.params.cv1Amt = 1;
            joystick.params.cv2Amt = 1;
            joystick.inputs.cv1.fill(1.25);
            joystick.inputs.cv2.fill(5);
            processBlocks(joystick, 2);

            expect(last(joystick.outputs.x)).toBeCloseTo(0, 3);
            expect(last(joystick.outputs.y)).toBeCloseTo(5, 3);
            ['x', 'y', 'a', 'b', 'c', 'd'].forEach(port => expectFiniteBuffer(joystick.outputs[port]));

            joystick.inputs.cv2.fill(0);
            processBlocks(joystick, 1);
            ['x', 'y', 'a', 'b', 'c', 'd'].forEach(port => expectFiniteBuffer(joystick.outputs[port]));
        });

        it('scans through a recorded gesture from CV and falls back safely without one', () => {
            const recorded = createRecordedJoystick();
            recorded.params.cvMode = 2;
            recorded.params.cv1Amt = 1;
            recorded.params.cv2Amt = 0.5;
            recorded.params.range = 0;
            recorded.inputs.cv1.fill(-5);
            processBlocks(recorded, 3);
            const startX = last(recorded.outputs.x);

            recorded.inputs.cv1.fill(5);
            processBlocks(recorded, 3);
            const endX = last(recorded.outputs.x);

            expect(startX).toBeLessThan(-3.5);
            expect(endX).toBeGreaterThan(3.5);

            joystick.params.cvMode = 2;
            joystick.params.cv1Amt = 1;
            joystick.params.cv2Amt = 1;
            joystick.inputs.cv1.fill(5);
            joystick.inputs.cv2.fill(-5);
            processBlocks(joystick, 2);
            expectFiniteBuffer(joystick.outputs.x);
            expectFiniteBuffer(joystick.outputs.y);
        });
    });

    describe('gate, trigger, and movement sense', () => {
        it('outputs 10V manual gate and one 8ms trigger pulse on rising edge', () => {
            joystick.params.gateButton = 1;
            joystick.params.sense = 0;
            joystick.process();

            expect([...joystick.outputs.gate]).toEqual(Array(BUFFER_SIZE).fill(10));
            expect(triggerHighCount(joystick.outputs.trig)).toBe(8);

            joystick.process();
            expect(triggerHighCount(joystick.outputs.trig)).toBe(0);

            joystick.params.gateButton = 0;
            joystick.process();
            expect([...joystick.outputs.gate]).toEqual(Array(BUFFER_SIZE).fill(0));
        });

        it('uses movement sense gate for changing joystick position only when enabled', () => {
            joystick.process();
            expect([...joystick.outputs.gate]).toEqual(Array(BUFFER_SIZE).fill(0));

            joystick.params.x = 1;
            joystick.process();
            expect(joystick.outputs.gate.some(value => value === 10)).toBe(true);
            expect(joystick.outputs.trig.some(value => value === 10)).toBe(true);

            processBlocks(joystick, 8);
            expect([...joystick.outputs.gate]).toEqual(Array(BUFFER_SIZE).fill(0));

            joystick.reset();
            joystick.params.sense = 0;
            joystick.params.x = -1;
            processBlocks(joystick, 2);
            expect([...joystick.outputs.gate]).toEqual(Array(BUFFER_SIZE).fill(0));
        });
    });

    describe('recording, playback, trigger input, and reset', () => {
        it('records X/Y/gate frames into bounded runtime storage', () => {
            const recorded = createRecordedJoystick();
            const info = recorded.getGestureInfo();

            expect(info.hasRecording).toBe(true);
            expect(info.length).toBeGreaterThan(2);
            expect(info.length).toBeLessThanOrEqual(info.maxFrames);

            expect(recorded.getGestureFrame(0).x).toBeLessThan(0);
            expect(recorded.getGestureFrame(0).y).toBeLessThan(0);
            expect(recorded.getGestureFrame(0).gate).toBe(1);
            expect(recorded.getGestureFrame(info.length - 1).x).toBeGreaterThan(0);
            expect(recorded.getGestureFrame(info.length - 1).y).toBeGreaterThan(0);
        });

        it('restarts armed recording on trigger input edges for synced capture', () => {
            const dsp = createJoystick({ sampleRate: 500, bufferSize: 4 });
            dsp.params.record = 1;
            dsp.params.x = -1;
            dsp.params.y = -1;
            dsp.process();

            expect(dsp.getGestureInfo().recording).toBe(true);
            expect(dsp.getGestureFrame(0).x).toBeLessThan(0);

            dsp.params.x = 1;
            dsp.params.y = 1;
            dsp.inputs.trigger.fill(0);
            dsp.inputs.trigger[0] = 10;
            dsp.process();

            dsp.params.record = 0;
            dsp.inputs.trigger.fill(0);
            dsp.process();

            expect(dsp.getGestureInfo().hasRecording).toBe(true);
            expect(dsp.getGestureFrame(0).x).toBeGreaterThan(0);
            expect(dsp.getGestureFrame(0).y).toBeGreaterThan(0);
        });

        it('plays back recorded gestures with interpolation and stops one-shots at the end', () => {
            const recorded = createRecordedJoystick();
            recorded.reset();
            recorded.params.loopMode = 0;
            recorded.params.play = 1;

            const values = [];
            for (let block = 0; block < 8; block++) {
                recorded.process();
                values.push(...recorded.outputs.x);
            }

            expect(values.some(value => value < -1)).toBe(true);
            expect(values.some(value => value > 1)).toBe(true);
            expect(recorded.getGestureInfo().playing).toBe(false);
            expect(recorded.params.play).toBe(0);
        });

        it('loops recorded gestures and keeps loop boundary samples finite', () => {
            const recorded = createRecordedJoystick();
            recorded.reset();
            recorded.params.loopMode = 1;
            recorded.params.play = 1;

            processBlocks(recorded, 20);

            expect(recorded.getGestureInfo().playing).toBe(true);
            ['x', 'y', 'a', 'b', 'c', 'd'].forEach(port => {
                expectFiniteBuffer(recorded.outputs[port]);
                expectBufferInRange(recorded.outputs[port], port === 'x' || port === 'y' ? -5 : 0, port === 'x' || port === 'y' ? 5 : 10);
            });
        });

        it('starts and retriggers playback from strict >2.5V trigger input edges', () => {
            const recorded = createRecordedJoystick();
            recorded.reset();
            recorded.params.loopMode = 1;
            recorded.inputs.trigger[0] = 2.5;
            recorded.process();

            expect(recorded.getGestureInfo().playing).toBe(false);

            recorded.inputs.trigger.fill(0);
            recorded.process();
            recorded.inputs.trigger[0] = 2.51;
            recorded.process();

            expect(recorded.getGestureInfo().playing).toBe(true);
            expect(recorded.params.play).toBe(1);
            expect(recorded.leds.trigger).toBe(1);
        });

        it('treats trigger-rearmed mode as trigger-started one-shot playback', () => {
            const recorded = createRecordedJoystick();
            recorded.reset();
            recorded.params.loopMode = 2;
            recorded.inputs.trigger[0] = 5;
            recorded.process();
            expect(recorded.params.play).toBe(1);

            recorded.inputs.trigger.fill(0);
            processBlocks(recorded, 8);
            expect(recorded.params.play).toBe(0);

            recorded.process();
            recorded.inputs.trigger[0] = 5;
            recorded.process();
            expect(recorded.params.play).toBe(1);
        });

        it('reset input stops transport while preserving params and recording', () => {
            const recorded = createRecordedJoystick();
            recorded.params.x = 0.25;
            recorded.params.y = -0.25;
            recorded.params.loopMode = 1;
            recorded.params.play = 1;
            recorded.process();
            expect(recorded.getGestureInfo().playing).toBe(true);

            recorded.inputs.reset[0] = 10;
            recorded.process();

            expect(recorded.getGestureInfo().playing).toBe(false);
            expect(recorded.getGestureInfo().hasRecording).toBe(true);
            expect(recorded.getGestureInfo().playHead).toBe(0);
            expect(recorded.params.x).toBe(0.25);
            expect(recorded.params.y).toBe(-0.25);
            expect(recorded.params.play).toBe(0);
        });

        it('reset() clears transport, LEDs, and buffers without erasing the runtime gesture', () => {
            const recorded = createRecordedJoystick();
            recorded.params.play = 1;
            recorded.process();
            recorded.reset();

            expect(recorded.getGestureInfo().hasRecording).toBe(true);
            expect(recorded.getGestureInfo().playing).toBe(false);
            expect(recorded.params.play).toBe(0);
            ['x', 'y', 'a', 'b', 'c', 'd', 'gate', 'trig'].forEach(port => {
                expect([...recorded.outputs[port]]).toEqual(Array(recorded.outputs[port].length).fill(0));
            });
            Object.values(recorded.leds).forEach(value => expect(value).toBe(0));
        });
    });

    describe('LEDs', () => {
        it('reflects axis polarity, quadrant amounts, gate, record, play, and trigger activity', () => {
            joystick.params.x = 1;
            joystick.params.y = -1;
            joystick.params.gateButton = 1;
            processBlocks(joystick, 2);

            expect(joystick.leds.xPositive).toBeGreaterThan(0.9);
            expect(joystick.leds.xNegative).toBe(0);
            expect(joystick.leds.yPositive).toBe(0);
            expect(joystick.leds.yNegative).toBeGreaterThan(0.9);
            expect(joystick.leds.c).toBeGreaterThan(0.9);
            expect(joystick.leds.gate).toBe(1);
            expect(joystick.leds.trigger).toBe(0);

            joystick.reset();
            joystick.params.record = 1;
            joystick.process();
            expect(joystick.leds.record).toBe(1);

            const recorded = createRecordedJoystick();
            recorded.reset();
            recorded.params.loopMode = 1;
            recorded.params.play = 1;
            recorded.process();
            expect(recorded.leds.play).toBe(1);
        });
    });
});
