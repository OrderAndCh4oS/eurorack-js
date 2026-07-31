import { describe, expect, it } from 'vitest';
import cvRecorder from '../../src/js/modules/cv-rec/index.js';

const EMPTY = 0;
const ARM = 1;
const REC = 2;
const PLAY = 3;
const PAUSE = 4;

function fillInputs(dsp, values = {}) {
    Object.entries(dsp.inputs).forEach(([name, buffer]) => {
        const value = values[name] ?? 0;
        if (typeof value === 'function') {
            for (let i = 0; i < buffer.length; i++) buffer[i] = value(i);
        } else {
            buffer.fill(value);
        }
    });
}

function processBlock(dsp, values = {}) {
    fillInputs(dsp, values);
    dsp.process();
}

function pulseAction(dsp, param, values = {}) {
    dsp.params[param] = 1;
    processBlock(dsp, values);
    dsp.params[param] = 0;
    processBlock(dsp);
}

function clockEdge(dsp, values = {}) {
    processBlock(dsp, { ...values, clock: i => i === 0 ? 10 : 0 });
}

function restoreState(dsp, {
    mode = 0,
    cv1 = [0, 1],
    cv2 = null,
    gate1 = null,
    gate2 = null,
    position = 0,
    playbackState = PLAY
} = {}) {
    const length = cv1.length;
    const safeCv2 = cv2 ?? new Array(length).fill(0);
    const safeGate1 = gate1 ?? new Array(length).fill(0);
    const safeGate2 = gate2 ?? new Array(length).fill(0);
    cvRecorder.restoreRuntimeState(dsp, {
        version: 1,
        freeFrameRate: 1000,
        recordedMode: mode,
        recordedLength: cv1.length,
        cv1: Float32Array.from(cv1),
        cv2: Float32Array.from(safeCv2),
        gate1: Uint8Array.from(safeGate1),
        gate2: Uint8Array.from(safeGate2),
        playPosition: position,
        playbackState
    });
}

function recordFree({ sampleRate, bufferSize, stopSample, sampleAt }) {
    const dsp = cvRecorder.createDSP({ sampleRate, bufferSize });
    dsp.params.mode = 0;
    let absolute = 0;

    while (absolute <= stopSample) {
        fillInputs(dsp);
        for (let i = 0; i < bufferSize; i++) {
            const sample = absolute + i;
            const frame = sampleAt(sample);
            dsp.inputs.cv1In[i] = frame.cv1;
            dsp.inputs.cv2In[i] = frame.cv2;
            dsp.inputs.gate1In[i] = frame.gate1;
            dsp.inputs.gate2In[i] = frame.gate2;
            dsp.inputs.recordTrig[i] = sample === 0 || sample === stopSample ? 10 : 0;
        }
        dsp.process();
        absolute += bufferSize;
    }

    return dsp;
}

describe('cv-rec', () => {
    it('declares the exact schema, telemetry, defaults, buffers, and normals', () => {
        expect(cvRecorder).toMatchObject({
            id: 'cv-rec',
            name: 'CV REC',
            hp: 12,
            color: 'module-color-seven',
            category: 'modulation',
            telemetry: {
                fields: ['transportState', 'recordedMode', 'recordedLength', 'playProgress'],
                methods: []
            }
        });
        expect(typeof cvRecorder.render).toBe('function');
        expect(cvRecorder.ui.switches).toHaveLength(3);
        expect(cvRecorder.ui.actions).toHaveLength(4);
        expect(cvRecorder.ui.inputs.map(input => input.port)).toEqual([
            'cv1In', 'gate1In', 'cv2In', 'gate2In', 'clock', 'recordTrig', 'reset'
        ]);
        expect(cvRecorder.ui.outputs.map(output => output.port)).toEqual([
            'cv1Out', 'gate1Out', 'cv2Out', 'gate2Out', 'eol'
        ]);
        expect(cvRecorder.ui.leds).toEqual([
            'recording', 'playing', 'memory', 'clock', 'eol', 'gate1', 'gate2', 'phase'
        ]);

        const dsp = cvRecorder.createDSP({ sampleRate: 48000, bufferSize: 128 });
        expect(dsp.params).toEqual({
            mode: 0,
            shape: 1,
            playMode: 0,
            record: 0,
            play: 0,
            resetAction: 0,
            clear: 0
        });
        Object.values(dsp.inputs).forEach(buffer => {
            expect(buffer).toBeInstanceOf(Float32Array);
            expect(buffer).toHaveLength(128);
            expect(buffer.every(value => value === 0)).toBe(true);
        });
        Object.values(dsp.outputs).forEach(buffer => {
            expect(buffer).toBeInstanceOf(Float32Array);
            expect(buffer).toHaveLength(128);
        });
        expect(dsp.transportState).toBe(EMPTY);
        expect(dsp.recordedMode).toBe(-1);
        expect(dsp.recordedLength).toBe(0);
        expect(dsp.playProgress).toBe(0);
        expect(dsp.getTransportInfo()).toMatchObject({ maxFrames: 60000, maxClockSteps: 1024 });
    });

    it('monitors both lanes independently with finite rails, exact gates, and stable buffers', () => {
        const dsp = cvRecorder.createDSP({ bufferSize: 8 });
        const inputRefs = { ...dsp.inputs };
        const outputRefs = { ...dsp.outputs };
        const cv1 = [-20, -10, -3, 0, 10, 20, NaN, Infinity];
        const cv2 = [20, 10, 3, 0, -10, -20, -Infinity, NaN];
        const gate1 = [0, 0.999, 1, 9, NaN, Infinity, -2, 0];
        const gate2 = [1, 0, 0, 0.999, 1, 10, NaN, -Infinity];

        processBlock(dsp, {
            cv1In: i => cv1[i],
            cv2In: i => cv2[i],
            gate1In: i => gate1[i],
            gate2In: i => gate2[i]
        });

        expect(Array.from(dsp.outputs.cv1Out)).toEqual([-10, -10, -3, 0, 10, 10, 0, 0]);
        expect(Array.from(dsp.outputs.cv2Out)).toEqual([10, 10, 3, 0, -10, -10, 0, 0]);
        expect(Array.from(dsp.outputs.gate1Out)).toEqual([0, 0, 10, 10, 0, 0, 0, 0]);
        expect(Array.from(dsp.outputs.gate2Out)).toEqual([10, 0, 0, 0, 10, 10, 0, 0]);
        expect(dsp.outputs.eol.every(value => value === 0)).toBe(true);
        Object.entries(inputRefs).forEach(([name, buffer]) => expect(dsp.inputs[name]).toBe(buffer));
        Object.entries(outputRefs).forEach(([name, buffer]) => expect(dsp.outputs[name]).toBe(buffer));
        Object.values(dsp.outputs).forEach(buffer => expect(buffer.every(Number.isFinite)).toBe(true));
    });

    it('records FREE frame zero and exact averaged half-open windows', () => {
        const dsp = recordFree({
            sampleRate: 48000,
            bufferSize: 128,
            stopSample: 96,
            sampleAt(sample) {
                return {
                    cv1: sample / 100,
                    cv2: -sample / 200,
                    gate1: sample === 10 ? 10 : 0,
                    gate2: sample === 70 ? 10 : 0
                };
            }
        });

        expect(dsp.transportState).toBe(PLAY);
        expect(dsp.recordedMode).toBe(0);
        expect(dsp.recordedLength).toBe(2);
        expect(dsp.getRecordedFrame(0)).toEqual({ cv1: 0, gate1: 0, cv2: -0, gate2: 0 });
        expect(dsp.getRecordedFrame(1).cv1).toBeCloseTo(0.245, 6);
        expect(dsp.getRecordedFrame(1).cv2).toBeCloseTo(-0.1225, 6);
        expect(dsp.getRecordedFrame(1).gate1).toBe(1);
        expect(dsp.getRecordedFrame(1).gate2).toBe(0);
    });

    it.each([
        [44100, 128],
        [44100, 512],
        [48000, 128],
        [96000, 512]
    ])('keeps the FREE rate exact at %i Hz / %i samples', (sampleRate, bufferSize) => {
        const dsp = recordFree({
            sampleRate,
            bufferSize,
            stopSample: sampleRate * 10,
            sampleAt: () => ({ cv1: 1.25, cv2: -2.5, gate1: 10, gate2: 0 })
        });
        expect(dsp.recordedLength).toBe(10000);
        expect(dsp.getRecordedFrame(9999)).toEqual({ cv1: 1.25, gate1: 1, cv2: -2.5, gate2: 0 });
    });

    it('rejects a too-short FREE take and gives stop/reset priority over accumulation', () => {
        const dsp = cvRecorder.createDSP({ sampleRate: 48000, bufferSize: 64 });
        dsp.params.mode = 0;
        processBlock(dsp, {
            cv1In: 4,
            recordTrig: i => i === 0 || i === 48 ? 10 : 0,
            reset: i => i === 48 ? 10 : 0
        });
        expect(dsp.transportState).toBe(EMPTY);
        expect(dsp.recordedLength).toBe(0);
        expect(dsp.outputs.cv1Out[48]).toBe(4);
    });

    it('reconstructs FREE CV as STEP or SMOOTH while gates stay stepped', () => {
        const stepped = cvRecorder.createDSP({ sampleRate: 4000, bufferSize: 4 });
        stepped.params.shape = 0;
        restoreState(stepped, { cv1: [0, 4], cv2: [2, -2], gate1: [0, 1], gate2: [1, 0] });
        processBlock(stepped);
        expect(Array.from(stepped.outputs.cv1Out)).toEqual([0, 0, 0, 0]);
        expect(Array.from(stepped.outputs.gate1Out)).toEqual([0, 0, 0, 0]);

        const smooth = cvRecorder.createDSP({ sampleRate: 4000, bufferSize: 4 });
        smooth.params.shape = 1;
        restoreState(smooth, { cv1: [0, 4], cv2: [2, -2], gate1: [0, 1], gate2: [1, 0] });
        processBlock(smooth);
        expect(Array.from(smooth.outputs.cv1Out)).toEqual([0, 1, 2, 3]);
        expect(Array.from(smooth.outputs.cv2Out)).toEqual([2, 1, 0, -1]);
        expect(Array.from(smooth.outputs.gate1Out)).toEqual([0, 0, 0, 0]);
        expect(Array.from(smooth.outputs.gate2Out)).toEqual([10, 10, 10, 10]);
    });

    it('arms, captures, cancels, and finalizes CLOCK recordings on exact edges', () => {
        const dsp = cvRecorder.createDSP({ sampleRate: 48000, bufferSize: 8 });
        dsp.params.mode = 1;

        pulseAction(dsp, 'record');
        expect(dsp.transportState).toBe(ARM);
        clockEdge(dsp, { cv1In: 1, gate1In: 1, cv2In: -1, gate2In: 0 });
        expect(dsp.transportState).toBe(REC);
        expect(dsp.recordedLength).toBe(1);
        expect(dsp.getRecordedFrame(0)).toEqual({ cv1: 1, gate1: 1, cv2: -1, gate2: 0 });

        clockEdge(dsp, { cv1In: 2, gate1In: 0, cv2In: -2, gate2In: 10 });
        expect(dsp.recordedLength).toBe(2);
        pulseAction(dsp, 'record');
        expect(dsp.transportState).toBe(ARM);
        pulseAction(dsp, 'record');
        expect(dsp.transportState).toBe(REC);
        pulseAction(dsp, 'record');
        clockEdge(dsp, { cv1In: 9, gate1In: 10, cv2In: 9, gate2In: 10 });

        expect(dsp.transportState).toBe(PLAY);
        expect(dsp.recordedLength).toBe(2);
        expect(dsp.getRecordedFrame(1)).toEqual({ cv1: 2, gate1: 0, cv2: -2, gate2: 1 });
        expect(dsp.outputs.cv1Out[0]).toBe(1);
        expect(dsp.outputs.gate1Out[0]).toBe(10);
    });

    it('uses strict clock/action thresholds and never repeats held inputs', () => {
        const dsp = cvRecorder.createDSP({ bufferSize: 8 });
        dsp.params.mode = 1;
        processBlock(dsp, { recordTrig: i => i === 0 ? 0.999 : 0 });
        expect(dsp.transportState).toBe(EMPTY);
        processBlock(dsp, { recordTrig: i => i === 0 ? 1 : 0 });
        expect(dsp.transportState).toBe(ARM);
        processBlock(dsp, { clock: 2.5, cv1In: 3 });
        expect(dsp.transportState).toBe(ARM);
        processBlock(dsp, { clock: 10, cv1In: 3 });
        expect(dsp.recordedLength).toBe(1);
        processBlock(dsp, { clock: 10, cv1In: 8 });
        expect(dsp.recordedLength).toBe(1);
    });

    it('combines same-sample panel/jack commands once and enforces command priority', () => {
        const dsp = cvRecorder.createDSP({ bufferSize: 8 });
        dsp.params.mode = 1;
        dsp.params.record = 1;
        processBlock(dsp, {
            recordTrig: i => i === 0 ? 10 : 0,
            clock: i => i === 0 ? 10 : 0,
            cv1In: 6
        });
        expect(dsp.transportState).toBe(REC);
        expect(dsp.recordedLength).toBe(1);

        dsp.params.record = 0;
        processBlock(dsp);
        dsp.params.clear = 1;
        dsp.params.record = 1;
        dsp.params.play = 1;
        processBlock(dsp, {
            recordTrig: i => i === 0 ? 10 : 0,
            reset: i => i === 0 ? 10 : 0,
            clock: i => i === 0 ? 10 : 0,
            cv1In: 9
        });
        expect(dsp.transportState).toBe(EMPTY);
        expect(dsp.recordedLength).toBe(0);
        expect(dsp.outputs.cv1Out[0]).toBe(9);
    });

    it('plays CLOCK STEP/SMOOTH causally and keeps gate changes on edges', () => {
        const stepped = cvRecorder.createDSP({ sampleRate: 1000, bufferSize: 4 });
        stepped.params.shape = 0;
        restoreState(stepped, { mode: 1, cv1: [0, 8, -4], cv2: [0, 4, 2], gate1: [0, 1, 0], gate2: [1, 0, 1] });
        clockEdge(stepped);
        expect(stepped.outputs.cv1Out[0]).toBe(8);
        expect(stepped.outputs.gate1Out[0]).toBe(10);
        expect(stepped.outputs.cv1Out[3]).toBe(8);

        const smooth = cvRecorder.createDSP({ sampleRate: 1000, bufferSize: 10 });
        smooth.params.shape = 1;
        restoreState(smooth, { mode: 1, cv1: [0, 8, -4], cv2: [0, 4, 2], gate1: [0, 1, 0], gate2: [1, 0, 1] });
        clockEdge(smooth);
        processBlock(smooth);
        clockEdge(smooth);
        expect(smooth.outputs.cv1Out[0]).toBe(-4);
        expect(smooth.outputs.gate1Out[0]).toBe(0);
        processBlock(smooth);
        expect(smooth.outputs.cv1Out[5]).toBeCloseTo(-1, 5);
        expect(smooth.outputs.gate1Out[5]).toBe(0);
    });

    it('toggles PLAY/PAUSE, rewinds without erasing, and clears on the command sample', () => {
        const dsp = cvRecorder.createDSP({ sampleRate: 4000, bufferSize: 4 });
        restoreState(dsp, { cv1: [0, 4, 8], gate1: [0, 1, 0] });
        processBlock(dsp);
        pulseAction(dsp, 'play');
        expect(dsp.transportState).toBe(PAUSE);
        const held = dsp.outputs.cv1Out[3];
        processBlock(dsp, { cv1In: -8 });
        expect(dsp.outputs.cv1Out.every(value => value === held)).toBe(true);

        pulseAction(dsp, 'resetAction');
        expect(dsp.transportState).toBe(PAUSE);
        expect(dsp.recordedLength).toBe(3);
        expect(dsp.outputs.cv1Out[0]).toBe(0);

        dsp.params.clear = 1;
        processBlock(dsp, { cv1In: -7, gate1In: 10 });
        expect(dsp.transportState).toBe(EMPTY);
        expect(dsp.recordedLength).toBe(0);
        expect(dsp.outputs.cv1Out[0]).toBe(-7);
        expect(dsp.outputs.gate1Out[0]).toBe(10);
    });

    it('emits an exact retriggerable 8 ms EOL pulse for LOOP and pauses ONE at the end', () => {
        const loop = cvRecorder.createDSP({ sampleRate: 1000, bufferSize: 4 });
        loop.params.playMode = 0;
        restoreState(loop, { mode: 1, cv1: [1, 2], cv2: [0, 0], gate1: [0, 0], gate2: [0, 0] });
        clockEdge(loop);
        clockEdge(loop);
        const samples = [];
        for (let block = 0; block < 3; block++) {
            if (block > 0) processBlock(loop);
            samples.push(...loop.outputs.eol);
        }
        expect(samples.slice(0, 8).every(value => value === 10)).toBe(true);
        expect(samples[8]).toBe(0);

        const one = cvRecorder.createDSP({ sampleRate: 1000, bufferSize: 4 });
        one.params.playMode = 1;
        restoreState(one, { mode: 1, cv1: [1, 2], cv2: [0, 0], gate1: [0, 1], gate2: [0, 0] });
        clockEdge(one);
        clockEdge(one);
        expect(one.transportState).toBe(PAUSE);
        expect(one.outputs.cv1Out[0]).toBe(2);
        expect(one.outputs.gate1Out[0]).toBe(10);
    });

    it.each([44100, 48000])(
        'latches an in-block EOL event for telemetry at %i Hz without extending the output pulse',
        sampleRate => {
            const dsp = cvRecorder.createDSP({ sampleRate, bufferSize: 512 });
            restoreState(dsp, { mode: 1, cv1: [1, 2] });
            clockEdge(dsp);
            clockEdge(dsp);

            const pulseSamples = Math.round(sampleRate * 0.008);
            expect(Array.from(dsp.outputs.eol).filter(value => value === 10)).toHaveLength(pulseSamples);
            expect(dsp.outputs.eol[pulseSamples]).toBe(0);
            expect(dsp.leds.eol).toBe(1);

            processBlock(dsp);
            expect(dsp.outputs.eol.every(value => value === 0)).toBe(true);
            expect(dsp.leds.eol).toBe(0);
        }
    );

    it('captures and atomically restores bounded runtime state in both modes', () => {
        const source = cvRecorder.createDSP({ sampleRate: 4000, bufferSize: 4 });
        source.params.shape = 1;
        restoreState(source, {
            cv1: [-10, 0, 10],
            cv2: [10, 0, -10],
            gate1: [0, 1, 0],
            gate2: [1, 0, 1],
            position: 1.25,
            playbackState: PAUSE
        });
        const snapshot = cvRecorder.captureRuntimeState(source);
        expect(snapshot.cv1).toBeInstanceOf(Float32Array);
        expect(snapshot.gate1).toBeInstanceOf(Uint8Array);
        expect(snapshot.recordedLength).toBe(3);

        const restored = cvRecorder.createDSP({ sampleRate: 4000, bufferSize: 4 });
        restored.params.shape = 1;
        cvRecorder.restoreRuntimeState(restored, snapshot);
        processBlock(restored);
        expect(restored.transportState).toBe(PAUSE);
        expect(restored.outputs.cv1Out[0]).toBeCloseTo(2.5, 6);
        expect(restored.outputs.gate1Out[0]).toBe(10);

        const invalid = cvRecorder.createDSP({ bufferSize: 4 });
        cvRecorder.restoreRuntimeState(invalid, { ...snapshot, cv1: Float32Array.of(NaN) });
        expect(invalid.transportState).toBe(EMPTY);
        expect(invalid.recordedLength).toBe(0);
    });

    it('commits valid partial runtime capture, while reset preserves memory and restarts at zero', () => {
        const dsp = cvRecorder.createDSP({ sampleRate: 48000, bufferSize: 128 });
        dsp.params.mode = 0;
        processBlock(dsp, {
            recordTrig: i => i === 0 ? 10 : 0,
            cv1In: i => i / 100
        });
        expect(dsp.transportState).toBe(REC);
        expect(dsp.recordedLength).toBeGreaterThanOrEqual(2);

        const partial = cvRecorder.captureRuntimeState(dsp);
        const restored = cvRecorder.createDSP({ sampleRate: 48000, bufferSize: 128 });
        cvRecorder.restoreRuntimeState(restored, partial);
        expect(restored.transportState).toBe(PLAY);
        expect(restored.playProgress).toBe(0);

        restored.reset();
        expect(restored.transportState).toBe(PLAY);
        expect(restored.recordedLength).toBe(partial.recordedLength);
        expect(Object.values(restored.inputs).every(buffer => buffer.every(value => value === 0))).toBe(true);
        expect(restored.params.record).toBe(0);
        expect(restored.params.play).toBe(0);
        processBlock(restored, { clock: 10 });
        expect(restored.outputs.cv1Out.every(Number.isFinite)).toBe(true);
    });

    it('auto-finalizes exact FREE and CLOCK capacities without overwriting', () => {
        const free = cvRecorder.createDSP({ sampleRate: 1000, bufferSize: 100 });
        free.params.mode = 0;
        for (let block = 0; block < 600; block++) {
            processBlock(free, {
                cv1In: block / 100,
                recordTrig: block === 0 ? i => i === 0 ? 10 : 0 : 0
            });
        }
        expect(free.transportState).toBe(PLAY);
        expect(free.recordedLength).toBe(60000);
        expect(free.getRecordedFrame(0).cv1).toBe(0);
        expect(free.outputs.eol.every(value => value === 0)).toBe(true);

        const clocked = cvRecorder.createDSP({ sampleRate: 48000, bufferSize: 4 });
        clocked.params.mode = 1;
        clocked.params.record = 1;
        clockEdge(clocked, { cv1In: 1 });
        clocked.params.record = 0;
        processBlock(clocked);
        for (let step = 1; step < 1024; step++) clockEdge(clocked, { cv1In: step / 200 });
        expect(clocked.transportState).toBe(PLAY);
        expect(clocked.recordedLength).toBe(1024);
        expect(clocked.getRecordedFrame(0).cv1).toBe(1);
        expect(clocked.getRecordedFrame(1023).cv1).toBeCloseTo(1023 / 200, 6);
        clockEdge(clocked, { cv1In: 9 });
        expect(clocked.getRecordedFrame(0).cv1).toBe(1);
    });

    it('keeps old playback intact through CLOCK arm/cancel and latches mode only on replacement', () => {
        const dsp = cvRecorder.createDSP({ sampleRate: 4000, bufferSize: 4 });
        restoreState(dsp, { mode: 0, cv1: [0, 2, 4], cv2: [0, 0, 0] });
        dsp.params.mode = 1;
        pulseAction(dsp, 'record');
        expect(dsp.transportState).toBe(ARM);
        expect(dsp.recordedLength).toBe(3);
        expect(dsp.outputs.cv1Out.some(value => value !== 0)).toBe(true);
        pulseAction(dsp, 'record');
        expect(dsp.transportState).toBe(PLAY);
        expect(dsp.getTransportInfo().memoryMode).toBe(0);

        pulseAction(dsp, 'record');
        clockEdge(dsp, { cv1In: 7, gate1In: 10 });
        expect(dsp.transportState).toBe(REC);
        expect(dsp.recordedMode).toBe(1);
        expect(dsp.recordedLength).toBe(1);
        expect(dsp.getRecordedFrame(0)).toEqual({ cv1: 7, gate1: 1, cv2: 0, gate2: 0 });
    });

    it('accepts one routed high CLOCK after lifecycle reset or runtime restore', () => {
        const dsp = cvRecorder.createDSP({ sampleRate: 48000, bufferSize: 8 });
        restoreState(dsp, { mode: 1, cv1: [1, 2], cv2: [0, 0] });
        dsp.reset();
        processBlock(dsp, { clock: 10 });
        expect(dsp.getTransportInfo().currentStep).toBe(1);
        processBlock(dsp, { clock: 10 });
        expect(dsp.getTransportInfo().currentStep).toBe(1);

        const snapshot = cvRecorder.captureRuntimeState(dsp);
        const restored = cvRecorder.createDSP({ sampleRate: 48000, bufferSize: 8 });
        cvRecorder.restoreRuntimeState(restored, snapshot);
        processBlock(restored, { clock: 10 });
        expect(restored.getTransportInfo().currentStep).toBe(0);
        processBlock(restored, { clock: 10 });
        expect(restored.getTransportInfo().currentStep).toBe(0);
    });

    it('records identical FREE data across block segmentation', () => {
        const options = {
            sampleRate: 48000,
            stopSample: 4800,
            sampleAt(sample) {
                return {
                    cv1: Math.sin(sample * 0.001) * 5,
                    cv2: Math.cos(sample * 0.0007) * 4,
                    gate1: sample % 333 < 48 ? 10 : 0,
                    gate2: sample % 511 < 96 ? 10 : 0
                };
            }
        };
        const shortBlocks = cvRecorder.captureRuntimeState(recordFree({ ...options, bufferSize: 128 }));
        const longBlocks = cvRecorder.captureRuntimeState(recordFree({ ...options, bufferSize: 512 }));
        expect(longBlocks.recordedLength).toBe(100);
        expect(longBlocks.cv1).toEqual(shortBlocks.cv1);
        expect(longBlocks.cv2).toEqual(shortBlocks.cv2);
        expect(longBlocks.gate1).toEqual(shortBlocks.gate1);
        expect(longBlocks.gate2).toEqual(shortBlocks.gate2);
    });

    it('keeps telemetry and LEDs finite and bounded through every transport state', () => {
        const dsp = cvRecorder.createDSP({ sampleRate: 48000, bufferSize: 16 });
        const assertFeedback = () => {
            expect([dsp.transportState, dsp.recordedMode, dsp.recordedLength, dsp.playProgress]
                .every(Number.isFinite)).toBe(true);
            Object.values(dsp.leds).forEach(value => {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
            });
        };

        processBlock(dsp, { gate1In: 10, gate2In: 10 });
        assertFeedback();
        dsp.params.mode = 1;
        pulseAction(dsp, 'record');
        expect(dsp.transportState).toBe(ARM);
        expect(dsp.leds.recording).toBe(0.5);
        assertFeedback();
        clockEdge(dsp, { gate1In: 10 });
        expect(dsp.transportState).toBe(REC);
        expect(dsp.leds.recording).toBe(1);
        assertFeedback();
    });
});
