import { describe, expect, it } from 'vitest';
import pitchTrackModule, {
    createPitchTrackAnalysisPlan,
    pitchTrackNextInvalidCount,
    pitchTrackLevelThreshold
} from '../../src/js/modules/pitch-track/index.js';

const C4_HZ = 261.6255653005986;
const E1_HZ = 41.20344461410875;
const E2_HZ = 82.4068892282175;
const C7_HZ = 2093.004522404789;

function createTracker({ sampleRate = 48000, bufferSize = 128, params = {} } = {}) {
    const dsp = pitchTrackModule.createDSP({ sampleRate, bufferSize });
    Object.assign(dsp.params, params);
    return dsp;
}

function createStream(dsp, sampleRate) {
    let cursor = 0;

    return {
        get cursor() {
            return cursor;
        },

        run(sampleCount, sampleAt) {
            const start = cursor;
            const end = start + sampleCount;
            let firstGate = -1;
            let firstPitchChange = -1;
            let lastPitch = dsp.outputs.pitch[dsp.outputs.pitch.length - 1] || 0;
            const gateSamples = [];
            const pitchSamples = [];

            while (cursor < end) {
                for (let index = 0; index < dsp.inputs.audio.length; index++) {
                    dsp.inputs.audio[index] = sampleAt(cursor + index);
                }
                dsp.process();
                for (let index = 0; index < dsp.outputs.gate.length; index++) {
                    const absolute = cursor + index;
                    const gate = dsp.outputs.gate[index];
                    const pitch = dsp.outputs.pitch[index];
                    if (absolute < end) {
                        gateSamples.push(gate);
                        pitchSamples.push(pitch);
                        if (firstGate < 0 && gate === 10) firstGate = absolute;
                        if (firstPitchChange < 0 && Math.abs(pitch - lastPitch) > 1e-7) {
                            firstPitchChange = absolute;
                        }
                    }
                    lastPitch = pitch;
                }
                cursor += dsp.inputs.audio.length;
            }

            return { firstGate, firstPitchChange, gateSamples, pitchSamples };
        }
    };
}

function sineAt(frequency, sampleRate, amplitude = 4, phaseOffset = 0) {
    return sample => amplitude * Math.sin(
        2 * Math.PI * frequency * sample / sampleRate + phaseOffset
    );
}

function harmonicAt(frequency, sampleRate, harmonicCount = 5, amplitude = 4) {
    let normalization = 0;
    for (let harmonic = 1; harmonic <= harmonicCount; harmonic++) {
        normalization += 1 / harmonic;
    }
    return sample => {
        let value = 0;
        for (let harmonic = 1; harmonic <= harmonicCount; harmonic++) {
            value += Math.sin(2 * Math.PI * frequency * harmonic * sample / sampleRate) / harmonic;
        }
        return amplitude * value / normalization;
    };
}

function seededNoise(seed = 1, amplitude = 4) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return amplitude * (state / 0xffffffff * 2 - 1);
    };
}

function expectedPitch(frequency) {
    return Math.log2(frequency / C4_HZ);
}

function centsBetween(actualPitch, expectedPitchValue) {
    return Math.abs(actualPitch - expectedPitchValue) * 1200;
}

function firstLevelOpenSample({ frequency, sampleRate, amplitude = 4, level = 0.5 }) {
    const attack = 1 - Math.exp(-1 / (sampleRate * 0.001));
    const release = 1 - Math.exp(-1 / (sampleRate * 0.020));
    const threshold = pitchTrackLevelThreshold(level);
    let envelope = 0;
    for (let sample = 0; sample < sampleRate; sample++) {
        const magnitude = Math.abs(sineAt(frequency, sampleRate, amplitude)(sample));
        const coefficient = magnitude > envelope ? attack : release;
        envelope += coefficient * (magnitude - envelope);
        if (envelope >= threshold) return sample;
    }
    return -1;
}

function acquire({
    frequency,
    sampleRate = 48000,
    bufferSize = 128,
    range = 0,
    smooth = 0,
    durationMs = 120,
    amplitude = 4
}) {
    const dsp = createTracker({
        sampleRate,
        bufferSize,
        params: { range, smooth }
    });
    const stream = createStream(dsp, sampleRate);
    const rendered = stream.run(
        Math.ceil(sampleRate * durationMs / 1000),
        sineAt(frequency, sampleRate, amplitude)
    );
    return {
        dsp,
        rendered,
        pitch: dsp.outputs.pitch[dsp.outputs.pitch.length - 1]
    };
}

describe('pitch-track', () => {
    describe('definition and initialization', () => {
        it('declares the exact compact utility contract without hidden surfaces', () => {
            const dsp = createTracker({ sampleRate: 44100, bufferSize: 512 });

            expect(pitchTrackModule).toMatchObject({
                id: 'pitch-track',
                name: 'PITCH TRACK',
                hp: 6,
                color: 'module-color-twelve',
                category: 'utility'
            });
            expect(pitchTrackModule.render).toBeUndefined();
            expect(pitchTrackModule.telemetry).toBeUndefined();
            expect(pitchTrackModule.handleWorkletEvent).toBeUndefined();
            expect(pitchTrackModule.ui.state).toBeUndefined();
            expect(pitchTrackModule.ui.knobs).toEqual([
                { id: 'level', label: 'LEVEL', param: 'level', min: 0, max: 1, default: 0.5 },
                { id: 'smooth', label: 'SMOOTH', param: 'smooth', min: 0, max: 250, default: 15 }
            ]);
            expect(pitchTrackModule.ui.switches).toEqual([
                {
                    id: 'range', label: 'FAST / LOW', param: 'range',
                    positions: ['FAST', 'LOW'], default: 0
                }
            ]);
            expect(pitchTrackModule.ui.inputs).toEqual([
                {
                    id: 'audio', label: 'IN', port: 'audio', signal: 'audio',
                    voltage: { min: -5, max: 5, normal: 0 }
                }
            ]);
            expect(pitchTrackModule.ui.outputs).toEqual([
                {
                    id: 'pitch', label: 'PITCH', port: 'pitch', signal: 'cv',
                    voltage: { min: -8 / 3, max: 3 }
                },
                {
                    id: 'gate', label: 'GATE', port: 'gate', signal: 'gate',
                    voltage: { min: 0, max: 10 }
                }
            ]);
            expect(pitchTrackModule.ui.leds).toEqual(['signal', 'lock']);
            expect(dsp.params).toEqual({ level: 0.5, smooth: 15, range: 0 });
            expect(Object.keys(dsp.inputs)).toEqual(['audio']);
            expect(Object.keys(dsp.outputs)).toEqual(['pitch', 'gate']);
            expect(dsp.inputs.audio).toBeInstanceOf(Float32Array);
            expect(dsp.outputs.pitch).toBeInstanceOf(Float32Array);
            expect(dsp.outputs.gate).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.audio).toHaveLength(512);
            expect(dsp.outputs.pitch).toHaveLength(512);
            expect(dsp.outputs.gate).toHaveLength(512);
            expect(dsp.inputs.audio.every(sample => sample === 0)).toBe(true);
            expect(dsp.outputs.pitch.every(sample => sample === 0)).toBe(true);
            expect(dsp.outputs.gate.every(sample => sample === 0)).toBe(true);
            expect(dsp.leds).toEqual({ signal: 0, lock: 0 });
        });

        it('maps Level to the exact logarithmic voltage thresholds', () => {
            expect(pitchTrackLevelThreshold(0)).toBeCloseTo(0.01, 12);
            expect(pitchTrackLevelThreshold(0.5)).toBeCloseTo(0.1, 12);
            expect(pitchTrackLevelThreshold(1)).toBeCloseTo(1, 12);
            expect(pitchTrackLevelThreshold(Number.NaN)).toBeCloseTo(0.1, 12);
        });

        it('precomputes the exact decimation and bounded incremental-YIN plans', () => {
            expect(createPitchTrackAnalysisPlan(44100, 0)).toMatchObject({
                decimationFactor: 3,
                analysisRate: 14700,
                frameLength: 512,
                hop: 128,
                lagsPerAnalysisSample: 2
            });
            expect(createPitchTrackAnalysisPlan(44100, 1)).toMatchObject({
                decimationFactor: 3,
                analysisRate: 14700,
                frameLength: 1024,
                hop: 128,
                lagsPerAnalysisSample: 3
            });
            const worst = createPitchTrackAnalysisPlan(48000, 1);
            expect(worst).toMatchObject({
                decimationFactor: 3,
                analysisRate: 16000,
                frameLength: 1024,
                minLag: 7,
                maxLag: 397,
                comparisonLength: 627,
                lagsPerAnalysisSample: 4,
                pairEvaluations: 248919
            });
            expect(createPitchTrackAnalysisPlan(96000, 1)).toEqual({
                ...worst,
                decimationFactor: 6
            });
            for (const sampleRate of [44100, 48000, 96000]) {
                for (const range of [0, 1]) {
                    const plan = createPitchTrackAnalysisPlan(sampleRate, range);
                    expect(plan.maxLag).toBeLessThanOrEqual(397);
                    expect(plan.lagsPerAnalysisSample).toBeLessThanOrEqual(4);
                    expect(plan.comparisonsPerTick).toBeLessThanOrEqual(2508);
                }
            }
        });
    });

    describe('range, mapping, and latency', () => {
        it.each([
            [110, -1.25, 5],
            [C4_HZ, 0, 5],
            [440, 0.75, 5],
            [1046.5022612023945, 2, 5],
            [C7_HZ, 3, 12]
        ])('tracks %.6f Hz at the continuous 1V/oct target', (frequency, volts, toleranceCents) => {
            const { dsp, rendered, pitch } = acquire({ frequency, smooth: 0 });

            expect(rendered.firstGate).toBeGreaterThanOrEqual(0);
            expect(centsBetween(pitch, volts)).toBeLessThanOrEqual(toleranceCents);
            expect(dsp.leds.lock).toBe(1);
            expect(dsp.outputs.gate.every(sample => sample === 0 || sample === 10)).toBe(true);
            expect(dsp.outputs.pitch.every(Number.isFinite)).toBe(true);
        });

        it('accepts E2 but rejects E1 in Fast, while Low accepts and clamps E1', () => {
            const fastE2 = acquire({ frequency: E2_HZ, range: 0, durationMs: 130 });
            const fastE1 = acquire({ frequency: E1_HZ, range: 0, durationMs: 180 });
            const lowE1 = acquire({ frequency: E1_HZ, range: 1, durationMs: 180 });

            expect(fastE2.rendered.firstGate).toBeGreaterThanOrEqual(0);
            expect(centsBetween(fastE2.pitch, -5 / 3)).toBeLessThanOrEqual(5);
            expect(fastE1.rendered.firstGate).toBe(-1);
            expect(fastE1.dsp.leds.lock).toBe(0);
            expect(lowE1.rendered.firstGate).toBeGreaterThanOrEqual(0);
            expect(centsBetween(lowE1.pitch, -8 / 3)).toBeLessThanOrEqual(5);
        });

        it.each([
            [44100, 0, 440, 43],
            [44100, 1, 55, 80],
            [48000, 0, 440, 41],
            [48000, 1, 55, 73],
            [96000, 0, 440, 41],
            [96000, 1, 55, 73]
        ])('locks within the %i Hz mode %i pure-tone ceiling', (
            sampleRate,
            range,
            frequency,
            ceilingMs
        ) => {
            const openSample = firstLevelOpenSample({ frequency, sampleRate });
            const fast = acquire({
                frequency, sampleRate, range, smooth: 0,
                durationMs: ceilingMs + 20
            });
            const smoothed = acquire({
                frequency, sampleRate, range, smooth: 250,
                durationMs: ceilingMs + 20
            });
            const latencyMs = (fast.rendered.firstGate - openSample) / sampleRate * 1000;

            expect(openSample).toBeGreaterThanOrEqual(0);
            expect(fast.rendered.firstGate).toBeGreaterThanOrEqual(openSample);
            expect(latencyMs).toBeLessThanOrEqual(ceilingMs);
            expect(smoothed.rendered.firstGate).toBe(fast.rendered.firstGate);
            expect(fast.rendered.firstPitchChange).toBe(fast.rendered.firstGate);
        });

        it('keeps silence finite, unlocked, and buffer-stable across the audit matrix', () => {
            for (const sampleRate of [44100, 48000, 96000]) {
                for (const bufferSize of [128, 512]) {
                    const dsp = createTracker({ sampleRate, bufferSize });
                    const input = dsp.inputs.audio;
                    const pitch = dsp.outputs.pitch;
                    const gate = dsp.outputs.gate;

                    for (let block = 0; block < 8; block++) dsp.process();

                    expect(dsp.inputs.audio).toBe(input);
                    expect(dsp.outputs.pitch).toBe(pitch);
                    expect(dsp.outputs.gate).toBe(gate);
                    expect(pitch.every(sample => sample === 0)).toBe(true);
                    expect(gate.every(sample => sample === 0)).toBe(true);
                    expect(dsp.leds).toEqual({ signal: 0, lock: 0 });
                }
            }
        });

        it('meets the pure-tone accuracy matrix at every audit rate and block size', () => {
            const frequencies = [E2_HZ, 110, C4_HZ, 440, 1046.5022612023945];
            const upperFrequencies = [1567.981743926997, C7_HZ];

            for (const sampleRate of [44100, 48000, 96000]) {
                for (const bufferSize of [128, 512]) {
                    for (const frequency of frequencies) {
                        const result = acquire({
                            frequency, sampleRate, bufferSize, smooth: 0, durationMs: 130
                        });
                        expect(result.rendered.firstGate).toBeGreaterThanOrEqual(0);
                        expect(centsBetween(result.pitch, expectedPitch(frequency))).toBeLessThanOrEqual(5);
                    }
                    for (const frequency of upperFrequencies) {
                        const result = acquire({
                            frequency, sampleRate, bufferSize, smooth: 0, durationMs: 130
                        });
                        expect(result.rendered.firstGate).toBeGreaterThanOrEqual(0);
                        expect(centsBetween(result.pitch, expectedPitch(frequency))).toBeLessThanOrEqual(12);
                        expect(result.pitch).toBeLessThanOrEqual(3);
                    }
                }
            }
        });

        it('keeps detuned pitches continuous instead of quantizing to semitones', () => {
            const frequency = 437.3;
            const result = acquire({ frequency, smooth: 0 });
            const semitones = result.pitch * 12;

            expect(centsBetween(result.pitch, expectedPitch(frequency))).toBeLessThanOrEqual(5);
            expect(Math.abs(semitones - Math.round(semitones))).toBeGreaterThan(0.05);
        });

        it('follows a slow continuous glide through non-semitone targets', () => {
            const sampleRate = 48000;
            const durationSeconds = 0.6;
            const startFrequency = 220;
            const frequencySlope = 220 / durationSeconds;
            const dsp = createTracker({ sampleRate, params: { smooth: 0 } });
            const rendered = createStream(dsp, sampleRate).run(
                Math.ceil(sampleRate * durationSeconds),
                sample => {
                    const time = sample / sampleRate;
                    const cycles = startFrequency * time + 0.5 * frequencySlope * time * time;
                    return 4 * Math.sin(2 * Math.PI * cycles);
                }
            );
            const lockedPitches = rendered.pitchSamples.filter((value, index) => (
                rendered.gateSamples[index] === 10 && value !== 0
            ));
            const targets = [...new Set(lockedPitches.map(value => value.toFixed(5)))];

            expect(targets.length).toBeGreaterThan(20);
            expect(lockedPitches[lockedPitches.length - 1]).toBeGreaterThan(lockedPitches[0]);
            expect(lockedPitches.some(value => (
                Math.abs(value * 12 - Math.round(value * 12)) > 0.05
            ))).toBe(true);
        });

        it('tracks harmonic sums and resolves the specified missing fundamental', () => {
            for (const frequency of [E2_HZ, 110, C4_HZ, 440, 1046.5022612023945]) {
                const dsp = createTracker({ params: { smooth: 0 } });
                const rendered = createStream(dsp, 48000).run(
                    Math.ceil(48000 * 0.14),
                    harmonicAt(frequency, 48000)
                );
                const actual = dsp.outputs.pitch[dsp.outputs.pitch.length - 1];
                expect(rendered.firstGate).toBeGreaterThanOrEqual(0);
                expect(centsBetween(actual, expectedPitch(frequency))).toBeLessThanOrEqual(10);
            }

            const dsp = createTracker({ params: { smooth: 0 } });
            const rendered = createStream(dsp, 48000).run(
                Math.ceil(48000 * 0.14),
                sample => 1.3 * (
                    Math.sin(2 * Math.PI * 220 * sample / 48000)
                    + Math.sin(2 * Math.PI * 330 * sample / 48000)
                    + Math.sin(2 * Math.PI * 440 * sample / 48000)
                )
            );
            const actual = dsp.outputs.pitch[dsp.outputs.pitch.length - 1];
            expect(rendered.firstGate).toBeGreaterThanOrEqual(0);
            expect(centsBetween(actual, expectedPitch(110))).toBeLessThanOrEqual(15);
        });

        it('clears lock on a range change, holds pitch, and requires a fresh frame', () => {
            const sampleRate = 48000;
            const dsp = createTracker({ sampleRate, params: { smooth: 0 } });
            const stream = createStream(dsp, sampleRate);
            stream.run(Math.ceil(sampleRate * 0.12), sineAt(110, sampleRate));
            const held = dsp.outputs.pitch[dsp.outputs.pitch.length - 1];
            expect(dsp.leds.lock).toBe(1);

            dsp.params.range = 1;
            const afterSwitch = stream.run(128, sineAt(55, sampleRate));
            expect(afterSwitch.gateSamples.every(value => value === 0)).toBe(true);
            expect(afterSwitch.pitchSamples.every(value => value === held)).toBe(true);
            expect(dsp.leds.lock).toBe(0);

            const beforeFullFrame = stream.run(
                Math.floor(sampleRate * 0.055),
                sineAt(55, sampleRate)
            );
            expect(beforeFullFrame.gateSamples.every(value => value === 0)).toBe(true);
            const relock = stream.run(
                Math.ceil(sampleRate * 0.04),
                sineAt(55, sampleRate)
            );
            expect(relock.firstGate).toBeGreaterThanOrEqual(0);
        });
    });

    describe('level, lock, and lifecycle', () => {
        it('does not lock below Level and closes immediately while holding Pitch', () => {
            const sampleRate = 48000;
            const quiet = acquire({
                frequency: 440, sampleRate, amplitude: 0.5,
                durationMs: 150, smooth: 0
            });
            quiet.dsp.params.level = 1;
            quiet.dsp.reset();
            const quietStream = createStream(quiet.dsp, sampleRate);
            const below = quietStream.run(
                Math.ceil(sampleRate * 0.15), sineAt(440, sampleRate, 0.5)
            );
            expect(below.firstGate).toBe(-1);

            const dsp = createTracker({ sampleRate, params: { smooth: 0 } });
            const stream = createStream(dsp, sampleRate);
            stream.run(Math.ceil(sampleRate * 0.12), sineAt(440, sampleRate));
            const held = dsp.outputs.pitch[dsp.outputs.pitch.length - 1];
            expect(dsp.leds.lock).toBe(1);
            const silence = stream.run(
                Math.ceil(sampleRate * 0.12), () => 0
            );
            expect(silence.gateSamples[silence.gateSamples.length - 1]).toBe(0);
            expect(dsp.leds.lock).toBe(0);
            const firstClosed = silence.gateSamples.indexOf(0);
            const heldAfterClose = silence.pitchSamples[firstClosed];
            expect(firstClosed).toBeGreaterThanOrEqual(0);
            expect(heldAfterClose).not.toBe(0);
            expect(silence.pitchSamples.slice(firstClosed).every(
                value => value === heldAfterClose
            )).toBe(true);
        });

        it('reports the continuous Signal level independently of pitch lock', () => {
            const sampleRate = 48000;
            const dsp = createTracker({ sampleRate });
            const stream = createStream(dsp, sampleRate);
            dsp.params.level = 0.5;

            stream.run(Math.ceil(sampleRate * 0.3), () => 0.1);
            expect(dsp.leds.signal).toBeCloseTo(0.5, 2);
            expect(dsp.leds.lock).toBe(0);
            stream.run(Math.ceil(sampleRate * 0.15), () => 4);
            expect(dsp.leds.signal).toBe(1);
            stream.run(Math.ceil(sampleRate * 0.3), () => 0);
            expect(dsp.leds.signal).toBeCloseTo(0, 4);
        });

        it('keeps the level state open at 80% and closes strictly below 70%', () => {
            const sampleRate = 48000;
            const dsp = createTracker({ sampleRate, params: { level: 0.5, smooth: 0 } });
            const stream = createStream(dsp, sampleRate);

            stream.run(Math.ceil(sampleRate * 0.015), () => 1);
            const belowOpenButAboveClose = stream.run(
                Math.ceil(sampleRate * 0.14),
                sample => 0.08 + 0.01 * Math.sin(2 * Math.PI * 440 * sample / sampleRate)
            );
            expect(belowOpenButAboveClose.firstGate).toBeGreaterThanOrEqual(0);
            expect(belowOpenButAboveClose.gateSamples.at(-1)).toBe(10);
            expect(dsp.leds.lock).toBe(1);
            expect(centsBetween(
                dsp.outputs.pitch[dsp.outputs.pitch.length - 1],
                expectedPitch(440)
            )).toBeLessThanOrEqual(5);

            const closed = stream.run(Math.ceil(sampleRate * 0.12), () => 0.069);
            expect(closed.gateSamples[closed.gateSamples.length - 1]).toBe(0);
            expect(dsp.leds.lock).toBe(0);
        });

        it('rejects DC and deterministic noise and keeps ambiguous chords rail-safe', () => {
            const sources = [
                seededNoise(12345),
                sample => 1.3 * (
                    Math.sin(2 * Math.PI * 220 * sample / 48000)
                    + Math.sin(2 * Math.PI * 277.1826309768721 * sample / 48000)
                    + Math.sin(2 * Math.PI * 329.6275569128699 * sample / 48000)
                )
            ];

            for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
                const dsp = createTracker({ params: { smooth: 0 } });
                createStream(dsp, 48000).run(Math.ceil(48000 * 0.2), sources[sourceIndex]);
                expect(dsp.outputs.pitch.every(Number.isFinite)).toBe(true);
                expect(dsp.outputs.pitch.every(value => value >= -8 / 3 && value <= 3)).toBe(true);
                expect(dsp.outputs.gate.every(value => value === 0 || value === 10)).toBe(true);
                if (sourceIndex === 0) expect(dsp.leds.lock).toBe(0);
            }

            const dc = createTracker({ params: { level: 1, smooth: 0 } });
            const dcStream = createStream(dc, 48000);
            dcStream.run(Math.ceil(48000 * 0.2), () => 0.5);
            dc.params.level = 0.5;
            dcStream.run(Math.ceil(48000 * 0.2), () => 0.5);
            expect(dc.leds.lock).toBe(0);
        });

        it('applies one invalid-result grace, then clears Gate on continued invalid input', () => {
            const sampleRate = 48000;
            const dsp = createTracker({ sampleRate, params: { range: 1, smooth: 0 } });
            const stream = createStream(dsp, sampleRate);
            stream.run(Math.ceil(sampleRate * 0.12), sineAt(110, sampleRate));
            expect(dsp.leds.lock).toBe(1);

            const constant = stream.run(Math.ceil(sampleRate * 0.1), () => 2);
            const firstZero = constant.gateSamples.indexOf(0);
            expect(firstZero).toBeGreaterThan(Math.floor(sampleRate * 0.03));
            expect(dsp.leds.lock).toBe(0);
        });

        it('retains on exactly one invalid result and lets a valid result reset grace', () => {
            let invalidCount = 0;
            invalidCount = pitchTrackNextInvalidCount(invalidCount, false);
            expect(invalidCount).toBe(1);
            expect(invalidCount < 2).toBe(true);

            invalidCount = pitchTrackNextInvalidCount(invalidCount, true);
            expect(invalidCount).toBe(0);
            invalidCount = pitchTrackNextInvalidCount(invalidCount, false);
            expect(invalidCount).toBe(1);
            invalidCount = pitchTrackNextInvalidCount(invalidCount, false);
            expect(invalidCount).toBe(2);
            expect(pitchTrackNextInvalidCount(invalidCount, false)).toBe(2);
        });

        it('uses the specified RC smoothing without changing Gate acquisition', () => {
            const sampleRate = 48000;
            const smooth15 = acquire({
                frequency: 440, sampleRate, smooth: 15, durationMs: 110
            });
            const gateSample = smooth15.rendered.firstGate;
            const at15 = smooth15.rendered.pitchSamples[gateSample + Math.round(sampleRate * 0.015)];
            const at45 = smooth15.rendered.pitchSamples[gateSample + Math.round(sampleRate * 0.045)];
            expect(at15 / 0.75).toBeCloseTo(1 - Math.exp(-1), 2);
            expect(at45 / 0.75).toBeCloseTo(1 - Math.exp(-3), 2);

            const smooth250 = acquire({
                frequency: 440, sampleRate, smooth: 250, durationMs: 110
            });
            const after15 = smooth250.rendered.pitchSamples[
                smooth250.rendered.firstGate + Math.round(sampleRate * 0.015)
            ];
            expect(after15).toBeGreaterThan(0);
            expect(after15).toBeLessThan(at15);
            for (let index = smooth250.rendered.firstGate + 1;
                index < smooth250.rendered.pitchSamples.length; index++) {
                expect(smooth250.rendered.pitchSamples[index]).toBeGreaterThanOrEqual(
                    smooth250.rendered.pitchSamples[index - 1]
                );
                expect(smooth250.rendered.pitchSamples[index]).toBeLessThanOrEqual(0.75);
            }
        });

        it('recovers from non-finite inputs and parameters with finite binary outputs', () => {
            const dsp = createTracker();
            dsp.params.level = Number.NaN;
            dsp.params.smooth = Number.POSITIVE_INFINITY;
            dsp.params.range = Number.NaN;
            for (let index = 0; index < dsp.inputs.audio.length; index++) {
                dsp.inputs.audio[index] = index % 2 ? Number.NaN : Number.POSITIVE_INFINITY;
            }
            for (let block = 0; block < 8; block++) dsp.process();
            expect(dsp.outputs.pitch.every(Number.isFinite)).toBe(true);
            expect(dsp.outputs.gate.every(value => value === 0 || value === 10)).toBe(true);
            expect(dsp.leds.signal).toBeGreaterThanOrEqual(0);
            expect(dsp.leds.signal).toBeLessThanOrEqual(1);
            expect(dsp.leds.lock).toBe(0);
        });

        it('resets dirty state to a fresh deterministic instance without replacing buffers', () => {
            const sampleRate = 48000;
            const dirty = createTracker({ sampleRate, params: { range: 1, smooth: 15 } });
            const fresh = createTracker({ sampleRate, params: { range: 1, smooth: 15 } });
            const inputIdentity = dirty.inputs.audio;
            const pitchIdentity = dirty.outputs.pitch;
            const gateIdentity = dirty.outputs.gate;
            createStream(dirty, sampleRate).run(
                Math.ceil(sampleRate * 0.12), harmonicAt(110, sampleRate)
            );
            dirty.reset();

            expect(dirty.inputs.audio).toBe(inputIdentity);
            expect(dirty.outputs.pitch).toBe(pitchIdentity);
            expect(dirty.outputs.gate).toBe(gateIdentity);
            expect(dirty.outputs.pitch.every(value => value === 0)).toBe(true);
            expect(dirty.outputs.gate.every(value => value === 0)).toBe(true);
            expect(dirty.leds).toEqual({ signal: 0, lock: 0 });

            const source = harmonicAt(110, sampleRate);
            for (let block = 0; block < 50; block++) {
                for (let index = 0; index < dirty.inputs.audio.length; index++) {
                    const sample = source(block * dirty.inputs.audio.length + index);
                    dirty.inputs.audio[index] = sample;
                    fresh.inputs.audio[index] = sample;
                }
                dirty.process();
                fresh.process();
                expect(dirty.outputs.pitch).toEqual(fresh.outputs.pitch);
                expect(dirty.outputs.gate).toEqual(fresh.outputs.gate);
                expect(dirty.leds).toEqual(fresh.leds);
            }
        });

        it('keeps the approved operation caps and an allocation-free process body', () => {
            const worst = createPitchTrackAnalysisPlan(48000, 1);
            expect(worst.maxLag).toBe(397);
            expect(worst.lagsPerAnalysisSample).toBe(4);
            expect(worst.pairEvaluations).toBe(248919);
            expect(worst.comparisonsPerTick).toBe(2508);

            const source = pitchTrackModule.createDSP.toString();
            const processBody = source.slice(source.indexOf('process()'), source.indexOf('reset()'));
            expect(processBody).not.toMatch(/\bnew\s|\.map\(|\.filter\(|\.reduce\(|=>/);
            expect(processBody).not.toMatch(/console\.|Promise|setTimeout|setInterval/);
        });
    });
});
