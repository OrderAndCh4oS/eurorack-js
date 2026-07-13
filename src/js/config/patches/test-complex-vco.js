export default {
    name: 'Test: Complex VCO',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clk', type: 'clk', row: 1, index: 0 },
            { id: 'seq', type: 'seq', row: 1, index: 1 },
            { id: 'lfo', type: 'lfo', row: 1, index: 2 },
            { id: 'env', type: 'adsr', row: 1, index: 3 },
            { id: 'complex', type: 'complex-vco', row: 2, index: 0 },
            { id: 'vca', type: 'vca', row: 2, index: 1 },
            { id: 'out', type: 'out', row: 2, index: 2 }
        ],
        params: {
            clk: { rate: 0.27, pause: 0 },
            seq: { step1: 0, step2: 0.25, step3: 0.5, step4: 0.25, step5: 0.75, step6: 0.5, step7: 0.25, step8: 0.625, length: 8, range: 1, direction: 0, gate1: 1, gate2: 1, gate3: 1, gate4: 1, gate5: 1, gate6: 1, gate7: 1, gate8: 1 },
            lfo: { rateKnob: 0.2, waveKnob: 0.25, range: 0 },
            env: { attack: 0.01, decay: 0.42, sustain: 0.38, release: 0.68 },
            complex: { coarse: 0.31, fine: 0, range: 0, expFmAmt: 0, tzFmAmt: 0, tzFmAc: 0, tzFmBias: 0, phaseAmt: 0.35, fundLevel: 0.7, evenLevel: 0.48, oddLevel: 0.42 },
            vca: { ch1Gain: 0.7, ch2Gain: 0 },
            out: { volume: 0.56 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'seq', toPort: 'clock' },
            { fromModule: 'seq', fromPort: 'cv', toModule: 'complex', toPort: 'vOct' },
            { fromModule: 'seq', fromPort: 'gate', toModule: 'env', toPort: 'gate' },
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'complex', toPort: 'phase' },
            { fromModule: 'complex', fromPort: 'full', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'env', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
