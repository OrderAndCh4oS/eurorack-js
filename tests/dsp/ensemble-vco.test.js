import { describe, expect, it, vi } from 'vitest';
import ensembleModule from '../../src/js/modules/ensemble-vco/index.js';
import { createPatchUrlHash, createVersionedPatch, parsePatchUrlHash } from '../../src/js/app/patch-format.js';
import { renderModule } from '../../src/js/ui/renderer.js';
import {
    energy,
    expectExhaustivePanelCoverage,
    expectFiniteVoltage,
    maxAbs
} from './panel-test-helpers.js';

function create(options = {}) {
    return ensembleModule.createDSP({ sampleRate: 8000, bufferSize: 1024, ...options });
}

function frequenciesWith(params = {}, inputs = {}) {
    const dsp = create({ bufferSize: 64 });
    Object.assign(dsp.params, params);
    Object.entries(inputs).forEach(([port, value]) => dsp.inputs[port].fill(value));
    dsp.process();
    return dsp.getVoiceFrequencies();
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
        expectExhaustivePanelCoverage(ensembleModule, {
            knobs: [
                'root', 'pitch', 'fine', 'spread', 'scale', 'detune', 'oscillatorCount',
                'balance', 'crossfade', 'crossFm', 'twist', 'warp', 'learnNote'
            ],
            buttons: ['scaleGroup', 'crossFmMode', 'twistMode', 'warpMode', 'stereoMode', 'freezeMode'],
            actions: ['freeze', 'learnMode', 'addNote', 'deleteNote', 'resetScale'],
            inputs: [
                'root', 'pitch', 'scaleCv', 'spreadCv', 'balanceCv', 'crossFmCv',
                'twistCv', 'warpCv', 'learn', 'freeze'
            ],
            outputs: ['mono', 'outA', 'outB'],
            leds: ['learn', 'freeze', 'scale']
        });
    });

    it('maps root, pitch, and fine knobs to independent pitch ranges', () => {
        const rootLow = frequenciesWith({ root: 0 })[0];
        const rootHigh = frequenciesWith({ root: 1 })[0];
        expect(rootHigh / rootLow).toBeCloseTo(16, 3);

        const pitchLow = frequenciesWith({ pitch: -1 })[0];
        const pitchHigh = frequenciesWith({ pitch: 1 })[0];
        expect(pitchHigh / pitchLow).toBeCloseTo(16, 3);

        const fineLow = frequenciesWith({ fine: -1 })[0];
        const fineHigh = frequenciesWith({ fine: 1 })[0];
        expect(fineHigh / fineLow).toBeCloseTo(2 ** (2 / 12), 5);
    });

    it.each([
        ['spread', { spread: 0 }, { spread: 1 }],
        ['scale', { scale: 0 }, { scale: 9 }],
        ['detune', { detune: 0 }, { detune: 1 }],
        ['crossfade', { crossfade: 0 }, { crossfade: 1 }]
    ])('%s changes the ensemble pitch distribution', (_param, lowParams, highParams) => {
        expect(frequenciesWith(lowParams).slice(0, 8)).not.toEqual(frequenciesWith(highParams).slice(0, 8));
    });

    it('uses oscillator count and balance to control voice allocation and spectral weighting', () => {
        const four = create({ bufferSize: 256 });
        four.params.oscillatorCount = 4;
        four.process();
        expect(four.getVoiceFrequencies().slice(0, 4).every(value => value > 0)).toBe(true);
        expect(four.getVoiceFrequencies()[4]).toBe(0);

        const low = create({ bufferSize: 256 });
        low.params.balance = 0;
        low.process();
        const high = create({ bufferSize: 256 });
        high.params.balance = 1;
        high.process();
        expect(Array.from(low.outputs.mono)).not.toEqual(Array.from(high.outputs.mono));
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

    it('applies Root and Pitch CV independently at one volt per octave', () => {
        const base = frequenciesWith()[0];
        expect(frequenciesWith({}, { root: 1 })[0]).toBeCloseTo(base * 2, 3);
        expect(frequenciesWith({}, { pitch: 1 })[0]).toBeCloseTo(base * 2, 3);
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

    it('selects scales and modulates spread and balance from their CV inputs', () => {
        expect(frequenciesWith({}, { scaleCv: 5 }).slice(0, 8))
            .not.toEqual(frequenciesWith({}, { scaleCv: 0 }).slice(0, 8));
        expect(frequenciesWith({}, { spreadCv: 5 }).slice(0, 8))
            .not.toEqual(frequenciesWith({}, { spreadCv: 0 }).slice(0, 8));

        const renderBalance = value => {
            const dsp = create({ bufferSize: 256 });
            dsp.params.balance = 0.5;
            dsp.inputs.balanceCv.fill(value);
            dsp.process();
            return Array.from(dsp.outputs.mono);
        };
        expect(renderBalance(-2.5)).not.toEqual(renderBalance(2.5));
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

    it.each([
        ['crossFmCv', 'crossFm'],
        ['twistCv', 'twist'],
        ['warpCv', 'warp']
    ])('%s modulates its matching shaping control', (inputPort, param) => {
        const plain = create({ bufferSize: 512 });
        plain.params[param] = 0;
        plain.process();
        const modulated = create({ bufferSize: 512 });
        modulated.params[param] = 0;
        modulated.inputs[inputPort].fill(5);
        modulated.process();
        expect(Array.from(modulated.outputs.mono)).not.toEqual(Array.from(plain.outputs.mono));
    });

    it('gives all three stereo routing buttons distinct A/B assignments', () => {
        const modes = [0, 1, 2].map(stereoMode => {
            const dsp = create({ bufferSize: 256 });
            dsp.params.stereoMode = stereoMode;
            dsp.process();
            return [Array.from(dsp.outputs.outA), Array.from(dsp.outputs.outB)];
        });
        expect(modes[0]).not.toEqual(modes[1]);
        expect(modes[1]).not.toEqual(modes[2]);
        expect(modes[0]).not.toEqual(modes[2]);
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

    it.each([
        [0, [0]],
        [1, [0, 1, 2, 3]],
        [2, [0, 2, 4, 6]]
    ])('freeze mode %i holds exactly its selected voices', (freezeMode, expectedFrozen) => {
        const dsp = create({ bufferSize: 32 });
        dsp.params.oscillatorCount = 8;
        dsp.params.freezeMode = freezeMode;
        dsp.process();
        const before = dsp.getVoiceFrequencies();
        dsp.toggleFreeze();
        dsp.inputs.root.fill(1);
        dsp.process();
        const after = dsp.getVoiceFrequencies();
        const frozenIndices = before.slice(0, 8)
            .map((value, index) => Math.abs(after[index] - value) < 1e-6 ? index : -1)
            .filter(index => index >= 0);
        expect(frozenIndices).toEqual(expectedFrozen);
    });

    it('enforces trigger thresholds and edge detection for Learn and Freeze inputs', () => {
        const learn = create({ bufferSize: 8 });
        learn.params.learnMode = 1;
        learn.params.scaleGroup = 2;
        learn.params.scale = 3;
        learn.inputs.pitch.fill(7 / 12);
        learn.inputs.learn[0] = 2.5;
        learn.process();
        expect(learn.params.scaleMemory['23']).toBeUndefined();
        learn.inputs.learn.fill(2.501);
        learn.process();
        expect(learn.params.scaleMemory['23']).toHaveLength(2);
        expect(learn.params.scaleMemory['23'][1]).toBeCloseTo(7, 5);
        learn.inputs.pitch.fill(10 / 12);
        learn.process();
        expect(learn.params.scaleMemory['23']).toHaveLength(2);
        learn.inputs.learn.fill(0);
        learn.process();
        learn.inputs.learn.fill(3);
        learn.process();
        expect(learn.params.scaleMemory['23']).toHaveLength(3);
        expect(learn.params.scaleMemory['23'][2]).toBeCloseTo(10, 5);

        const freeze = create({ bufferSize: 8 });
        freeze.process();
        freeze.inputs.freeze.fill(2.5);
        freeze.process();
        expect(freeze.getFrozen()).toBe(false);
        freeze.inputs.freeze.fill(2.501);
        freeze.process();
        expect(freeze.getFrozen()).toBe(true);
        freeze.process();
        expect(freeze.getFrozen()).toBe(true);
        freeze.inputs.freeze.fill(0);
        freeze.process();
        freeze.inputs.freeze.fill(3);
        freeze.process();
        expect(freeze.getFrozen()).toBe(false);
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

    it('wires every custom panel action to DSP state and patch callbacks', () => {
        vi.useFakeTimers();
        const dsp = create({ bufferSize: 16 });
        dsp.process();
        const onParamChange = vi.fn();
        const panel = renderModule(ensembleModule, 'ensemble_actions', { dsp, onParamChange });
        document.body.appendChild(panel);

        panel.querySelector('[data-param="learnMode"]').click();
        expect(dsp.params.learnMode).toBe(1);
        expect(dsp.leds.learn).toBe(0);

        panel.querySelector('[data-param="freeze"]').click();
        expect(dsp.getFrozen()).toBe(true);
        expect(dsp.params.freeze).toBe(1);

        dsp.params.learnNote = 7;
        panel.querySelector('[data-param="addNote"]').click();
        expect(dsp.params.scaleMemory['1']).toEqual([0, 7]);
        panel.querySelector('[data-param="deleteNote"]').click();
        expect(dsp.params.scaleMemory['1']).toEqual([0]);
        panel.querySelector('[data-param="resetScale"]').click();
        expect(dsp.params.scaleMemory['1']).toBeUndefined();
        expect(onParamChange).toHaveBeenCalledWith('ensemble_actions', 'scaleMemory', expect.any(Object));

        vi.runAllTimers();
        panel.remove();
        vi.useRealTimers();
    });

    it('drives all outputs and exposes learn, freeze, and scale LED state', () => {
        const dsp = create({ bufferSize: 256 });
        dsp.params.learnMode = 1;
        dsp.process();
        ['mono', 'outA', 'outB'].forEach(port => expect(energy(dsp.outputs[port])).toBeGreaterThan(1e-7));
        expect(dsp.leds.learn).toBe(1);
        expect(dsp.leds.scale).toBe(1);
        dsp.toggleFreeze();
        dsp.process();
        expect(dsp.leds.freeze).toBe(1);
        expect(dsp.leds.scale).toBeLessThan(1);
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
        });
        expectFiniteVoltage(dsp.outputs, 5);
        dsp.reset();
        expect(dsp.getFrozen()).toBe(false);
        expect(dsp.leds).toEqual({ learn: 0, freeze: 0, scale: 0 });
        Object.values(dsp.outputs).forEach(output => expect(maxAbs(output)).toBe(0));
    });
});
