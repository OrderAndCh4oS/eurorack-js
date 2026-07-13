export default {
    name: 'Test: Resonator Bank',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clk', type: 'clk', row: 1, index: 0 },
            { id: 'seq', type: 'seq', row: 1, index: 1 },
            { id: 'resbank', type: 'resbank', row: 2, index: 0 },
            { id: 'out', type: 'out', row: 2, index: 1 }
        ],
        params: {
            clk: { rate: 0.25, pause: 0 },
            seq: { step1: 0, step2: 0.25, step3: 0.5, step4: 0.75, step5: 0.375, step6: 0.625, step7: 0.25, step8: 0.875, length: 8, range: 1, direction: 0, gate1: 1, gate2: 1, gate3: 1, gate4: 1, gate5: 1, gate6: 1, gate7: 1, gate8: 1 },
            resbank: { frequency: 0.34, frequencyAmt: 0, structure: 0.46, structureAmt: 0, brightness: 0.68, brightnessAmt: 0, damping: 0.57, dampingAmt: 0, position: 0.32, positionAmt: 0, model: 0, polyphony: 2 },
            out: { volume: 0.66 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'seq', toPort: 'clock' },
            { fromModule: 'seq', fromPort: 'cv', toModule: 'resbank', toPort: 'vOct' },
            { fromModule: 'seq', fromPort: 'gate', toModule: 'resbank', toPort: 'strum' },
            { fromModule: 'resbank', fromPort: 'odd', toModule: 'out', toPort: 'L' },
            { fromModule: 'resbank', fromPort: 'even', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
