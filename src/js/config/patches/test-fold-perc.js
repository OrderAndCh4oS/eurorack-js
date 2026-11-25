export default {
    name: 'Test - Fold Percussion',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clk', type: 'clk', row: 1, index: 0 },
            { id: 'seq', type: 'seq', row: 1, index: 1 },
            { id: 'perc', type: 'fold-perc', row: 1, index: 2 },
            { id: 'out', type: 'out', row: 1, index: 3 }
        ],
        params: {
            clk: { rate: 0.32 },
            seq: {
                length: 8, range: 2, direction: 0,
                step1: 0, step2: 0.12, step3: 0.47, step4: 0.25,
                step5: 0, step6: 0.72, step7: 0.3, step8: 0.95,
                gate1: 1, gate2: 1, gate3: 0, gate4: 1,
                gate5: 1, gate6: 1, gate7: 0, gate8: 1
            },
            perc: {
                mode: 1, range: 0, pitch: 0.25, attack: 0.49,
                decay: 0.58, morph: 0.08, harmonic: 0.55, spread: 0.15, fold: 0.08
            },
            out: { volume: 0.62 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'seq', toPort: 'clock' },
            { fromModule: 'seq', fromPort: 'gate', toModule: 'perc', toPort: 'trigger' },
            { fromModule: 'seq', fromPort: 'cv', toModule: 'perc', toPort: 'foldCV' },
            { fromModule: 'perc', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'perc', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
