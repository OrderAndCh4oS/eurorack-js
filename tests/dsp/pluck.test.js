import { describe, it, expect, beforeEach } from 'vitest';
import pluckModule from '../../src/js/modules/pluck/index.js';

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 512;

const createPluck = (options = {}) => pluckModule.createDSP({
    sampleRate: SAMPLE_RATE,
    bufferSize: BUFFER_SIZE,
    ...options
});

function setTrigger(pluck, voltage = 10) {
    pluck.inputs.trigger.fill(0);
    pluck.inputs.trigger[0] = voltage;
}

function clearInputs(pluck) {
    Object.values(pluck.inputs).forEach(input => input.fill(0));
}

function processBuffers(pluck, count) {
    for (let i = 0; i < count; i++) {
        if (i > 0) pluck.inputs.trigger.fill(0);
        pluck.process();
    }
}

function maxAbs(buffer) {
    return Math.max(...Array.from(buffer, value => Math.abs(value)));
}

function rms(buffer) {
    const sum = buffer.reduce((total, value) => total + value * value, 0);
    return Math.sqrt(sum / buffer.length);
}

function meanAbsDiff(buffer) {
    let total = 0;
    for (let i = 1; i < buffer.length; i++) {
        total += Math.abs(buffer[i] - buffer[i - 1]);
    }
    return total / (buffer.length - 1);
}

function diffSum(a, b) {
    let total = 0;
    for (let i = 0; i < a.length; i++) {
        total += Math.abs(a[i] - b[i]);
    }
    return total;
}

function triggeredBuffer(params = {}, inputSetup = () => {}) {
    const pluck = createPluck();
    Object.assign(pluck.params, params);
    inputSetup(pluck);
    setTrigger(pluck);
    pluck.process();
    return {
        output: Float32Array.from(pluck.outputs.out),
        debug: pluck.getDebugState()
    };
}

describe('PLUCK (four-voice plucked string)', () => {
    let pluck;

    beforeEach(() => {
        pluck = createPluck();
    });

    describe('initialization', () => {
        it('creates params, inputs, outputs, LEDs, and debug state', () => {
            expect(pluck.params).toEqual({
                pitch: 0.4,
                decay: 0.65,
                damp: 0.65,
                position: 0.35
            });
            expect(pluck.inputs.trigger).toBeInstanceOf(Float32Array);
            expect(pluck.inputs.vOct).toBeInstanceOf(Float32Array);
            expect(pluck.inputs.decayCV).toBeInstanceOf(Float32Array);
            expect(pluck.inputs.dampCV).toBeInstanceOf(Float32Array);
            expect(pluck.inputs.positionCV).toBeInstanceOf(Float32Array);
            expect(pluck.outputs.out).toBeInstanceOf(Float32Array);
            expect(pluck.outputs.out.length).toBe(BUFFER_SIZE);
            expect(pluck.leds.active).toBe(0);
            expect(pluck.getDebugState().activeVoiceCount).toBe(0);
        });

        it('accepts custom buffer options', () => {
            const custom = createPluck({ sampleRate: 48000, bufferSize: 128 });
            expect(custom.outputs.out.length).toBe(128);
            expect(custom.inputs.trigger.length).toBe(128);
        });

        it('defines the expected module contract', () => {
            expect(pluckModule.id).toBe('pluck');
            expect(pluckModule.name).toBe('PLUCK');
            expect(pluckModule.category).toBe('voice');
            expect(pluckModule.hp).toBe(6);
            expect(pluckModule.ui.inputs.map(input => input.port)).toEqual([
                'trigger',
                'vOct',
                'decayCV',
                'dampCV',
                'positionCV'
            ]);
            expect(pluckModule.ui.outputs.map(output => output.port)).toEqual(['out']);
        });
    });

    describe('trigger and polyphony behavior', () => {
        it('stays silent until triggered', () => {
            pluck.process();

            expect(maxAbs(pluck.outputs.out)).toBe(0);
            expect(pluck.leds.active).toBe(0);
            expect(pluck.getDebugState().activeVoiceCount).toBe(0);
        });

        it('creates one note on a >=1V rising edge', () => {
            setTrigger(pluck, 0.99);
            pluck.process();
            expect(maxAbs(pluck.outputs.out)).toBe(0);
            expect(pluck.getDebugState().activeVoiceCount).toBe(0);

            pluck.reset();
            setTrigger(pluck, 1);
            pluck.process();

            expect(maxAbs(pluck.outputs.out)).toBeGreaterThan(0.01);
            expect(pluck.getDebugState().activeVoiceCount).toBe(1);
        });

        it('does not retrigger while the trigger remains high', () => {
            pluck.inputs.trigger.fill(10);
            pluck.process();
            const afterFirst = pluck.getDebugState();

            pluck.process();
            const afterSecond = pluck.getDebugState();

            expect(afterFirst.nextVoiceIndex).toBe(1);
            expect(afterSecond.nextVoiceIndex).toBe(1);
            expect(afterSecond.activeVoiceCount).toBe(1);
            expect(afterSecond.voices[0].ageSamples).toBeGreaterThan(afterFirst.voices[0].ageSamples);
        });

        it('keeps four overlapping voices and steals the oldest on a fifth trigger', () => {
            pluck.params.decay = 1;

            for (let note = 0; note < 5; note++) {
                setTrigger(pluck);
                pluck.process();
                pluck.inputs.trigger.fill(0);
                pluck.process();
            }

            const debug = pluck.getDebugState();
            expect(debug.activeVoiceCount).toBe(4);
            expect(debug.latestVoiceIndex).toBe(0);
            expect(debug.nextVoiceIndex).toBe(1);
            expect(debug.voices.every(voice => voice.active)).toBe(true);
            expect(debug.voices[0].ageSamples).toBeLessThan(debug.voices[1].ageSamples);
        });
    });

    describe('pitch behavior', () => {
        it('maps the pitch knob across five octaves', () => {
            const low = triggeredBuffer({ pitch: 0 }).debug.voices[0].frequency;
            const high = triggeredBuffer({ pitch: 1 }).debug.voices[0].frequency;

            expect(low).toBeCloseTo(55, 3);
            expect(high / low).toBeCloseTo(32, 2);
        });

        it('tracks 1V/oct at trigger time', () => {
            const base = triggeredBuffer({ pitch: 0.45 }, pluckInstance => {
                pluckInstance.inputs.vOct.fill(0);
            }).debug.voices[0].frequency;
            const octaveUp = triggeredBuffer({ pitch: 0.45 }, pluckInstance => {
                pluckInstance.inputs.vOct.fill(1);
            }).debug.voices[0].frequency;
            const octaveDown = triggeredBuffer({ pitch: 0.45 }, pluckInstance => {
                pluckInstance.inputs.vOct.fill(-1);
            }).debug.voices[0].frequency;

            expect(octaveUp / base).toBeCloseTo(2, 3);
            expect(base / octaveDown).toBeCloseTo(2, 3);
        });

        it('lets only the most recent voice follow pitch changes', () => {
            pluck.params.pitch = 0.25;
            setTrigger(pluck);
            pluck.process();
            pluck.inputs.trigger.fill(0);
            pluck.process();

            pluck.params.pitch = 0.4;
            setTrigger(pluck);
            pluck.process();

            const beforeChange = pluck.getDebugState();
            pluck.params.pitch = 0.8;
            pluck.inputs.vOct.fill(1);
            pluck.inputs.trigger.fill(0);
            pluck.process();
            const afterChange = pluck.getDebugState();

            expect(afterChange.voices[0].frequency).toBeCloseTo(beforeChange.voices[0].frequency, 6);
            expect(afterChange.voices[1].frequency).toBeGreaterThan(beforeChange.voices[1].frequency * 3);
        });
    });

    describe('decay, damp, and position controls', () => {
        it('samples decay, damp, and position at note start', () => {
            pluck.params.decay = 0.25;
            pluck.params.damp = 0.3;
            pluck.params.position = 0.4;
            setTrigger(pluck);
            pluck.process();
            const atTrigger = pluck.getDebugState().voices[0];

            pluck.params.decay = 1;
            pluck.params.damp = 1;
            pluck.params.position = 0.9;
            pluck.inputs.decayCV.fill(5);
            pluck.inputs.dampCV.fill(5);
            pluck.inputs.positionCV.fill(5);
            pluck.inputs.trigger.fill(0);
            pluck.process();
            const afterChange = pluck.getDebugState().voices[0];

            expect(afterChange.decay).toBeCloseTo(atTrigger.decay, 6);
            expect(afterChange.damp).toBeCloseTo(atTrigger.damp, 6);
            expect(afterChange.position).toBeCloseTo(atTrigger.position, 6);
        });

        it('decays faster at low decay settings than high decay settings', () => {
            const short = createPluck();
            short.params.decay = 0;
            setTrigger(short);
            processBuffers(short, 30);
            const shortLevel = rms(short.outputs.out);

            const long = createPluck();
            long.params.decay = 1;
            setTrigger(long);
            processBuffers(long, 30);
            const longLevel = rms(long.outputs.out);

            expect(longLevel).toBeGreaterThan(shortLevel * 3);
            expect(longLevel).toBeGreaterThan(0.001);
        });

        it('scales decay CV as bipolar -5V to +5V modulation', () => {
            const short = createPluck();
            short.params.decay = 0.4;
            short.inputs.decayCV.fill(-5);
            setTrigger(short);
            processBuffers(short, 24);

            const long = createPluck();
            long.params.decay = 0.4;
            long.inputs.decayCV.fill(5);
            setTrigger(long);
            processBuffers(long, 24);

            expect(rms(long.outputs.out)).toBeGreaterThan(rms(short.outputs.out) * 2);
        });

        it('darkens with low damp and brightens with high damp', () => {
            const dark = triggeredBuffer({ damp: 0.05 }).output;
            const bright = triggeredBuffer({ damp: 1 }).output;

            expect(meanAbsDiff(bright)).toBeGreaterThan(meanAbsDiff(dark) * 1.35);
        });

        it('scales damp CV as bipolar -5V to +5V modulation', () => {
            const dark = triggeredBuffer({ damp: 0.5 }, pluckInstance => {
                pluckInstance.inputs.dampCV.fill(-5);
            }).output;
            const bright = triggeredBuffer({ damp: 0.5 }, pluckInstance => {
                pluckInstance.inputs.dampCV.fill(5);
            }).output;

            expect(meanAbsDiff(bright)).toBeGreaterThan(meanAbsDiff(dark) * 1.35);
        });

        it('changes timbre with position knob and CV while staying in range', () => {
            const nearBridge = triggeredBuffer({ position: 0.1 }).output;
            const center = triggeredBuffer({ position: 0.5 }).output;
            const cvShifted = triggeredBuffer({ position: 0.5 }, pluckInstance => {
                pluckInstance.inputs.positionCV.fill(2.5);
            }).output;

            expect(diffSum(nearBridge, center)).toBeGreaterThan(1);
            expect(diffSum(center, cvShifted)).toBeGreaterThan(1);
            expect(maxAbs(nearBridge)).toBeLessThanOrEqual(5);
            expect(maxAbs(center)).toBeLessThanOrEqual(5);
            expect(maxAbs(cvShifted)).toBeLessThanOrEqual(5);
        });
    });

    describe('output, LED, and reset behavior', () => {
        it('keeps output finite and within +/-5V under repeated triggers and extreme CV', () => {
            pluck.params.pitch = 1;
            pluck.params.decay = 1;
            pluck.params.damp = 1;
            pluck.params.position = 1;
            pluck.inputs.vOct.fill(3);
            pluck.inputs.decayCV.fill(5);
            pluck.inputs.dampCV.fill(5);
            pluck.inputs.positionCV.fill(5);

            for (let i = 0; i < 12; i++) {
                setTrigger(pluck);
                pluck.process();
                expect(Array.from(pluck.outputs.out).every(Number.isFinite)).toBe(true);
                expect(maxAbs(pluck.outputs.out)).toBeLessThanOrEqual(5);
                pluck.inputs.trigger.fill(0);
                pluck.process();
            }
        });

        it('raises the active LED on output and lets it decay', () => {
            pluck.params.decay = 0;
            setTrigger(pluck);
            pluck.process();
            const peakLed = pluck.leds.active;

            clearInputs(pluck);
            processBuffers(pluck, 80);

            expect(peakLed).toBeGreaterThan(0);
            expect(pluck.leds.active).toBeLessThan(peakLed);
        });

        it('clears active voices, output, trigger history, and LED on reset', () => {
            setTrigger(pluck);
            pluck.process();
            expect(pluck.getDebugState().activeVoiceCount).toBe(1);

            pluck.reset();

            expect(pluck.getDebugState().activeVoiceCount).toBe(0);
            expect(maxAbs(pluck.outputs.out)).toBe(0);
            expect(pluck.leds.active).toBe(0);

            clearInputs(pluck);
            pluck.process();
            expect(maxAbs(pluck.outputs.out)).toBe(0);

            setTrigger(pluck);
            pluck.process();
            expect(maxAbs(pluck.outputs.out)).toBeGreaterThan(0.01);
        });
    });
});
