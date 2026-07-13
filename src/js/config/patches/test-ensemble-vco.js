export default {
    name: 'Test: Ensemble VCO',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'lfo', type: 'lfo', row: 1, index: 0 },
            { id: 'ensemble', type: 'ensemble-vco', row: 1, index: 1 },
            { id: 'out', type: 'out', row: 1, index: 2 }
        ],
        params: {
            lfo: { rateKnob: 0.1, waveKnob: 0.2, range: 0 },
            ensemble: { root: 0.31, pitch: 0, fine: 0, spread: 0.52, scale: 1, scaleGroup: 0, detune: 0.12, oscillatorCount: 12, balance: 0.52, crossfade: 0.7, crossFm: 0.08, crossFmMode: 0, twist: 0.14, twistMode: 1, warp: 0.08, warpMode: 0, stereoMode: 0, freezeMode: 0, freeze: 0, learnMode: 0, learnNote: 7, addNote: 0, deleteNote: 0, resetScale: 0, scaleMemory: {} },
            out: { volume: 0.54 }
        },
        cables: [
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'ensemble', toPort: 'spreadCv' },
            { fromModule: 'ensemble', fromPort: 'outA', toModule: 'out', toPort: 'L' },
            { fromModule: 'ensemble', fromPort: 'outB', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
