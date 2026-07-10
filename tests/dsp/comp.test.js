import { describe, it, expect, beforeEach } from 'vitest';
import compModule from '../../src/js/modules/comp/index.js';

const sampleRate = 44100;
const bufferSize = 256;

function createComp() {
    return compModule.createDSP({ sampleRate, bufferSize });
}

function runBlocks(dsp, count = 1) {
    for (let i = 0; i < count; i++) dsp.process();
}

function setProgram(dsp, left, right = left) {
    dsp.inputs.inL.fill(left);
    dsp.inputs.inR.fill(right);
}

function configureFastCompressor(dsp) {
    dsp.params.threshold = 0.35;
    dsp.params.ratio = 1;
    dsp.params.attack = 0;
    dsp.params.release = 0;
    dsp.params.makeup = 12 / 30;
    dsp.params.mix = 1;
    dsp.params.detector = 1;
    dsp.params.mode = 0;
    dsp.params.filterMode = 0;
    dsp.params.bypass = 0;
}

function maxAbs(buffer) {
    return Math.max(...Array.from(buffer, Math.abs));
}

function expectFinite(buffer) {
    expect(Array.from(buffer).every(Number.isFinite)).toBe(true);
}

describe('COMP Module', () => {
    let dsp;

    beforeEach(() => {
        dsp = createComp();
    });

    describe('initialization', () => {
        it('creates the panel contract from the research spec', () => {
            expect(compModule.id).toBe('comp');
            expect(compModule.category).toBe('utility');
            expect(compModule.hp).toBe(8);

            for (const port of ['inL', 'inR', 'sidechain', 'thresholdCV', 'attackCV', 'releaseCV', 'makeupCV', 'filterCV']) {
                expect(dsp.inputs[port]).toBeInstanceOf(Float32Array);
                expect(dsp.inputs[port].length).toBe(bufferSize);
            }

            for (const port of ['outL', 'outR', 'env', 'gr']) {
                expect(dsp.outputs[port]).toBeInstanceOf(Float32Array);
                expect(dsp.outputs[port].length).toBe(bufferSize);
            }

            for (const param of ['threshold', 'ratio', 'attack', 'release', 'makeup', 'sideFilter', 'mix', 'mode', 'detector', 'filterMode', 'bypass']) {
                expect(dsp.params).toHaveProperty(param);
            }

            expect(dsp.leds).toEqual({ level: 0, gainReduction: 0, limit: 0 });
        });

        it('starts near the documented default values', () => {
            expect(dsp.params.threshold).toBeCloseTo(24 / 36, 5);
            expect(dsp.params.ratio).toBeGreaterThan(0.45);
            expect(dsp.params.ratio).toBeLessThan(0.47);
            expect(dsp.params.attack).toBeCloseTo(2 / 3, 2);
            expect(dsp.params.release).toBeGreaterThan(0.53);
            expect(dsp.params.release).toBeLessThan(0.54);
            expect(dsp.params.makeup).toBeCloseTo(0.4, 5);
            expect(dsp.params.mix).toBe(1);
        });
    });

    describe('basic processing', () => {
        it('outputs silence and finite buffers with no input', () => {
            runBlocks(dsp, 4);

            expect(maxAbs(dsp.outputs.outL)).toBe(0);
            expect(maxAbs(dsp.outputs.outR)).toBe(0);
            expect(maxAbs(dsp.outputs.env)).toBe(0);
            expect(maxAbs(dsp.outputs.gr)).toBe(0);

            for (const buffer of Object.values(dsp.outputs)) expectFinite(buffer);
            expect(dsp.leds.level).toBe(0);
            expect(dsp.leds.gainReduction).toBe(0);
        });

        it('passes below-threshold audio without gain reduction at 0 dB makeup', () => {
            dsp.params.threshold = 1;
            dsp.params.ratio = 1;
            dsp.params.makeup = 12 / 30;
            dsp.params.detector = 1;
            setProgram(dsp, 0.5);

            dsp.process();

            expect(dsp.outputs.outL[bufferSize - 1]).toBeCloseTo(0.5, 5);
            expect(dsp.outputs.outR[bufferSize - 1]).toBeCloseTo(0.5, 5);
            expect(maxAbs(dsp.outputs.gr)).toBe(0);
        });

        it('reduces above-threshold audio as ratio increases', () => {
            configureFastCompressor(dsp);
            setProgram(dsp, 4);

            dsp.params.ratio = 0;
            runBlocks(dsp, 20);
            const unityRatioOut = dsp.outputs.outL[bufferSize - 1];

            dsp.reset();
            configureFastCompressor(dsp);
            setProgram(dsp, 4);
            dsp.params.ratio = 1;
            runBlocks(dsp, 80);
            const highRatioOut = dsp.outputs.outL[bufferSize - 1];

            expect(unityRatioOut).toBeCloseTo(4, 4);
            expect(highRatioOut).toBeLessThan(2.2);
            expect(dsp.outputs.gr[bufferSize - 1]).toBeGreaterThan(1);
            expect(dsp.leds.gainReduction).toBeGreaterThan(0);
        });

        it('blends dry and compressed signals with mix', () => {
            configureFastCompressor(dsp);
            setProgram(dsp, 4);
            dsp.params.mix = 0;
            runBlocks(dsp, 60);
            const dryOut = dsp.outputs.outL[bufferSize - 1];

            dsp.reset();
            configureFastCompressor(dsp);
            setProgram(dsp, 4);
            dsp.params.mix = 1;
            runBlocks(dsp, 60);
            const wetOut = dsp.outputs.outL[bufferSize - 1];

            expect(dryOut).toBeCloseTo(4, 4);
            expect(wetOut).toBeLessThan(dryOut);
        });

        it('protects audio outputs at +/-5 V and lights the limit LED when clipped', () => {
            dsp.params.threshold = 1;
            dsp.params.ratio = 0;
            dsp.params.makeup = 1;
            dsp.params.detector = 1;
            setProgram(dsp, 5);

            dsp.process();

            expect(maxAbs(dsp.outputs.outL)).toBeLessThanOrEqual(5);
            expect(maxAbs(dsp.outputs.outR)).toBeLessThanOrEqual(5);
            expect(dsp.leds.limit).toBe(1);
        });
    });

    describe('controls and CV', () => {
        it('threshold CV lowers and raises the compression point by 6 dB per volt', () => {
            configureFastCompressor(dsp);
            setProgram(dsp, 2);
            dsp.inputs.thresholdCV.fill(-2);
            runBlocks(dsp, 60);
            const loweredThresholdOut = dsp.outputs.outL[bufferSize - 1];

            dsp.reset();
            configureFastCompressor(dsp);
            setProgram(dsp, 2);
            dsp.inputs.thresholdCV.fill(2);
            runBlocks(dsp, 60);
            const raisedThresholdOut = dsp.outputs.outL[bufferSize - 1];

            expect(loweredThresholdOut).toBeLessThan(raisedThresholdOut);
        });

        it('attack knob and CV control gain-reduction rise speed', () => {
            configureFastCompressor(dsp);
            setProgram(dsp, 5);
            dsp.params.attack = 0;
            dsp.inputs.attackCV.fill(-5);
            dsp.process();
            const fastAttackOut = dsp.outputs.outL[bufferSize - 1];

            dsp.reset();
            configureFastCompressor(dsp);
            setProgram(dsp, 5);
            dsp.params.attack = 1;
            dsp.inputs.attackCV.fill(5);
            dsp.process();
            const slowAttackOut = dsp.outputs.outL[bufferSize - 1];

            expect(fastAttackOut).toBeLessThan(slowAttackOut);
        });

        it('release knob and CV control gain-reduction recovery speed', () => {
            configureFastCompressor(dsp);
            setProgram(dsp, 5);
            dsp.params.release = 0;
            dsp.inputs.releaseCV.fill(-5);
            runBlocks(dsp, 60);
            setProgram(dsp, 0.2);
            dsp.process();
            const fastReleaseGr = dsp.outputs.gr[bufferSize - 1];

            dsp.reset();
            configureFastCompressor(dsp);
            setProgram(dsp, 5);
            dsp.params.release = 1;
            dsp.inputs.releaseCV.fill(5);
            runBlocks(dsp, 60);
            setProgram(dsp, 0.2);
            dsp.process();
            const slowReleaseGr = dsp.outputs.gr[bufferSize - 1];

            expect(fastReleaseGr).toBeLessThan(slowReleaseGr);
        });

        it('makeup CV changes level and respects the final ceiling', () => {
            dsp.params.threshold = 1;
            dsp.params.ratio = 0;
            dsp.params.makeup = 12 / 30;
            dsp.params.detector = 1;
            setProgram(dsp, 1);
            dsp.inputs.makeupCV.fill(-1);
            dsp.process();
            const lowerMakeup = dsp.outputs.outL[bufferSize - 1];

            dsp.reset();
            dsp.params.threshold = 1;
            dsp.params.ratio = 0;
            dsp.params.makeup = 12 / 30;
            dsp.params.detector = 1;
            setProgram(dsp, 1);
            dsp.inputs.makeupCV.fill(1);
            dsp.process();
            const higherMakeup = dsp.outputs.outL[bufferSize - 1];

            expect(higherMakeup).toBeGreaterThan(lowerMakeup);

            setProgram(dsp, 5);
            dsp.inputs.makeupCV.fill(5);
            dsp.process();
            expect(maxAbs(dsp.outputs.outL)).toBeLessThanOrEqual(5);
        });

        it('filter mode and filter CV alter sidechain detector sensitivity', () => {
            configureFastCompressor(dsp);
            setProgram(dsp, 3);
            dsp.inputs.sidechain.fill(5);
            dsp.params.filterMode = 0;
            runBlocks(dsp, 80);
            const unfilteredOut = dsp.outputs.outL[bufferSize - 1];

            dsp.reset();
            configureFastCompressor(dsp);
            setProgram(dsp, 3);
            dsp.inputs.sidechain.fill(5);
            dsp.params.filterMode = 1;
            dsp.params.sideFilter = 1;
            dsp.inputs.filterCV.fill(2);
            runBlocks(dsp, 80);
            const highPassedOut = dsp.outputs.outL[bufferSize - 1];

            expect(highPassedOut).toBeGreaterThan(unfilteredOut);
        });
    });

    describe('detector, sidechain, and stereo behavior', () => {
        it('peak detector reacts more strongly than RMS detector to a transient', () => {
            configureFastCompressor(dsp);
            dsp.inputs.inL[0] = 5;
            dsp.params.detector = 0;
            dsp.process();
            const rmsEnv = maxAbs(dsp.outputs.env);

            dsp.reset();
            configureFastCompressor(dsp);
            dsp.inputs.inL[0] = 5;
            dsp.params.detector = 1;
            dsp.process();
            const peakEnv = maxAbs(dsp.outputs.env);

            expect(peakEnv).toBeGreaterThan(rmsEnv);
            expect(peakEnv).toBeCloseTo(10, 5);
        });

        it('external sidechain ducks program audio independently of program level', () => {
            configureFastCompressor(dsp);
            setProgram(dsp, 1);
            runBlocks(dsp, 40);
            const noSidechainOut = dsp.outputs.outL[bufferSize - 1];

            dsp.reset();
            configureFastCompressor(dsp);
            setProgram(dsp, 1);
            dsp.inputs.sidechain.fill(5);
            runBlocks(dsp, 80);
            const duckedOut = dsp.outputs.outL[bufferSize - 1];

            expect(duckedOut).toBeLessThan(noSidechainOut);
            expect(dsp.outputs.env[bufferSize - 1]).toBeGreaterThan(9);
        });

        it('normalizes unpatched right input from left input', () => {
            configureFastCompressor(dsp);
            dsp.inputs.inL.fill(1.25);

            dsp.process();

            expect(dsp.outputs.outL[bufferSize - 1]).toBeCloseTo(dsp.outputs.outR[bufferSize - 1], 5);
            expect(dsp.outputs.outR[bufferSize - 1]).toBeGreaterThan(0);
        });

        it('uses stereo-linked gain reduction when either channel crosses threshold', () => {
            configureFastCompressor(dsp);
            dsp.inputs.inL.fill(5);
            dsp.inputs.inR.fill(1);
            runBlocks(dsp, 80);

            expect(dsp.outputs.outR[bufferSize - 1]).toBeLessThan(1);
            expect(dsp.outputs.outL[bufferSize - 1] / 5).toBeCloseTo(dsp.outputs.outR[bufferSize - 1] / 1, 1);
        });

        it('emits 0-10 V envelope and gain-reduction CV outputs', () => {
            configureFastCompressor(dsp);
            setProgram(dsp, 5);
            runBlocks(dsp, 80);

            for (const value of dsp.outputs.env) {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(10);
            }
            for (const value of dsp.outputs.gr) {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(10);
            }
            expect(dsp.outputs.env[bufferSize - 1]).toBeCloseTo(10, 5);
            expect(dsp.outputs.gr[bufferSize - 1]).toBeGreaterThan(0);
        });
    });

    describe('modes and state', () => {
        it('limit mode forces peak high-ratio behavior and lights the limit LED', () => {
            configureFastCompressor(dsp);
            setProgram(dsp, 4);
            dsp.params.ratio = 0;
            dsp.params.mode = 0;
            runBlocks(dsp, 20);
            const compModeOut = dsp.outputs.outL[bufferSize - 1];

            dsp.reset();
            configureFastCompressor(dsp);
            setProgram(dsp, 4);
            dsp.params.ratio = 0;
            dsp.params.mode = 1;
            runBlocks(dsp, 80);
            const limitModeOut = dsp.outputs.outL[bufferSize - 1];

            expect(limitModeOut).toBeLessThan(compModeOut);
            expect(dsp.leds.limit).toBe(1);
        });

        it('bypass passes dry audio and suppresses env/gr outputs', () => {
            configureFastCompressor(dsp);
            setProgram(dsp, 3);
            dsp.inputs.sidechain.fill(5);
            dsp.params.bypass = 1;

            dsp.process();

            expect(dsp.outputs.outL[bufferSize - 1]).toBeCloseTo(3, 5);
            expect(dsp.outputs.outR[bufferSize - 1]).toBeCloseTo(3, 5);
            expect(maxAbs(dsp.outputs.env)).toBe(0);
            expect(maxAbs(dsp.outputs.gr)).toBe(0);
            expect(dsp.leds.gainReduction).toBe(0);
        });

        it('reset clears envelopes, outputs, LED state, and owned input buffers', () => {
            configureFastCompressor(dsp);
            setProgram(dsp, 5);
            dsp.inputs.sidechain.fill(5);
            runBlocks(dsp, 20);

            dsp.reset();

            for (const buffer of Object.values(dsp.outputs)) expect(maxAbs(buffer)).toBe(0);
            for (const buffer of Object.values(dsp.inputs)) expect(maxAbs(buffer)).toBe(0);
            expect(dsp.leds).toEqual({ level: 0, gainReduction: 0, limit: 0 });
        });

        it('keeps input buffers stable across processing and clears them on reset', () => {
            configureFastCompressor(dsp);
            const inputs = { ...dsp.inputs };

            dsp.inputs.inL.fill(2);
            dsp.inputs.inR.fill(2);
            dsp.inputs.sidechain.fill(2);
            dsp.inputs.thresholdCV.fill(1);
            dsp.inputs.attackCV.fill(1);
            dsp.inputs.releaseCV.fill(1);
            dsp.inputs.makeupCV.fill(1);
            dsp.inputs.filterCV.fill(1);

            dsp.process();
            Object.entries(inputs).forEach(([name, buffer]) => expect(dsp.inputs[name]).toBe(buffer));

            dsp.reset();
            Object.entries(inputs).forEach(([name, buffer]) => expect(dsp.inputs[name]).toBe(buffer));
            for (const buffer of Object.values(dsp.inputs)) expect(maxAbs(buffer)).toBe(0);
        });
    });
});
