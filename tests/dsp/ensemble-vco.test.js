import { describe, expect, it } from 'vitest';
import ensembleModule from '../../src/js/modules/ensemble-vco/index.js';
import { createPatchUrlHash, createVersionedPatch, parsePatchUrlHash } from '../../src/js/app/patch-format.js';

function create(options = {}) {
    return ensembleModule.createDSP({ sampleRate: 8000, bufferSize: 1024, ...options });
}

function energy(values) {
    return values.reduce((sum, value) => sum + value * value, 0) / values.length;
}

describe('ensemble-vco', () => {
    it('declares the complete oscillator bank contract', () => {
        const dsp = create({ bufferSize: 64 });
        expect(ensembleModule).toMatchObject({ id: 'ensemble-vco', category: 'source', hp: 16 });
        expect(Object.keys(dsp.inputs)).toEqual([
            'root', 'pitch', 'scaleCv', 'spreadCv', 'balanceCv', 'crossFmCv', 'twistCv', 'warpCv', 'learn', 'freeze'
        ]);
        expect(Object.keys(dsp.outputs)).toEqual(['mono', 'outA', 'outB']);
        expect(dsp.getVoiceFrequencies()).toHaveLength(16);
        expect(dsp.params.scaleMemory).toEqual({});
    });

    it('keeps useful level as oscillator count changes', () => {
        const single = create();
        single.params.oscillatorCount = 1;
        single.process();
        const many = create();
        many.params.oscillatorCount = 16;
        many.process();
        const ratio = energy(many.outputs.mono) / energy(single.outputs.mono);
        expect(ratio).toBeGreaterThan(0.2);
        expect(ratio).toBeLessThan(5);
    });

    it('tracks Pitch at one volt per octave after quantization', () => {
        const base = create({ bufferSize: 64 });
        base.process();
        const octave = create({ bufferSize: 64 });
        octave.inputs.pitch.fill(1);
        octave.process();
        expect(octave.getVoiceFrequencies()[0]).toBeCloseTo(base.getVoiceFrequencies()[0] * 2, 3);
    });

    it('provides distinct scale groups and responds smoothly to spread', () => {
        const groups = [0, 1, 2].map(scaleGroup => {
            const dsp = create({ bufferSize: 64 });
            dsp.params.scaleGroup = scaleGroup;
            dsp.params.scale = 4;
            dsp.params.spread = 0.7;
            dsp.process();
            return dsp.getVoiceFrequencies().slice(0, 8);
        });
        expect(groups[0]).not.toEqual(groups[1]);
        expect(groups[1]).not.toEqual(groups[2]);

        const dsp = create({ bufferSize: 64 });
        dsp.params.spread = 0.2;
        dsp.process();
        const narrow = dsp.getVoiceFrequencies()[7];
        dsp.params.spread = 0.21;
        dsp.process();
        expect(Math.abs(dsp.getVoiceFrequencies()[7] - narrow)).toBeLessThan(narrow * 0.2);
    });

    it('implements distinct cross-FM, Twist, and Warp modes', () => {
        for (const [param, amount] of [['crossFm', 0.8], ['twist', 0.8], ['warp', 0.8]]) {
            const outputs = [0, 1, 2].map(mode => {
                const dsp = create();
                dsp.params[param] = amount;
                dsp.params[`${param}Mode`] = mode;
                dsp.process();
                return Array.from(dsp.outputs.mono);
            });
            expect(outputs[0]).not.toEqual(outputs[1]);
            expect(outputs[1]).not.toEqual(outputs[2]);
        }
    });

    it('routes stereo modes and freezes only the selected pitch subset', () => {
        const dsp = create({ bufferSize: 128 });
        dsp.params.oscillatorCount = 8;
        dsp.params.stereoMode = 0;
        dsp.process();
        expect(Array.from(dsp.outputs.outA)).not.toEqual(Array.from(dsp.outputs.outB));

        dsp.params.freezeMode = 0;
        dsp.inputs.freeze[0] = 10;
        dsp.process();
        const frozen = dsp.getVoiceFrequencies();
        dsp.inputs.freeze.fill(0);
        dsp.inputs.root.fill(1);
        dsp.process();
        const shifted = dsp.getVoiceFrequencies();
        expect(shifted[0]).toBeCloseTo(frozen[0], 5);
        expect(shifted[1]).toBeGreaterThan(frozen[1] * 1.5);
    });

    it('learns, deletes, and restores a patch-local custom scale', () => {
        const dsp = create({ bufferSize: 16 });
        dsp.params.learnMode = 1;
        dsp.params.scaleGroup = 2;
        dsp.params.scale = 3;
        dsp.inputs.pitch.fill(7 / 12);
        dsp.inputs.learn[0] = 3;
        dsp.process();
        expect(dsp.params.scaleMemory['23'][1]).toBeCloseTo(7, 5);
        dsp.deleteLearnedNote();
        expect(dsp.params.scaleMemory['23']).toEqual([0]);
        dsp.resetFactoryScale();
        expect(dsp.params.scaleMemory['23']).toBeUndefined();
    });

    it('round-trips nested scale memory through patch v3', async () => {
        const state = {
            version: 3,
            plugins: { core: 1 },
            modules: [{ id: 'ensemble', type: 'ensemble-vco', row: 1, index: 0 }],
            params: { ensemble: { scaleMemory: { 23: [0, 3.5, 7, 10.2] } } },
            cables: [],
            midiMappings: {}
        };
        const encoded = await createPatchUrlHash(createVersionedPatch('Scale', state), { moduleDefinitions: [ensembleModule] });
        const decoded = await parsePatchUrlHash(encoded, { moduleDefinitions: [ensembleModule] });
        expect(decoded.state.params.ensemble.scaleMemory).toEqual({ 23: [0, 3.5, 7, 10.2] });
    });

    it('fills stable finite output buffers inside +/-5V and resets deterministically', () => {
        const dsp = create({ sampleRate: 48000, bufferSize: 256 });
        const refs = { ...dsp.outputs };
        dsp.params.crossFm = 1;
        dsp.params.twist = 1;
        dsp.params.warp = 1;
        Object.values(dsp.inputs).forEach(input => input.fill(10));
        dsp.process();
        Object.entries(dsp.outputs).forEach(([port, output]) => {
            expect(output).toBe(refs[port]);
            output.forEach(value => {
                expect(Number.isFinite(value)).toBe(true);
                expect(Math.abs(value)).toBeLessThanOrEqual(5.00001);
            });
        });
        dsp.reset();
        expect(dsp.getFrozen()).toBe(false);
        expect(dsp.leds).toEqual({ learn: 0, freeze: 0, scale: 0 });
    });
});
