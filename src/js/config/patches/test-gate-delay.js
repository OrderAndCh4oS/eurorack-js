export default {
    name: 'Test: Gate Delay',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clk', type: 'clk', row: 1, index: 0 },
            { id: 'delay', type: 'gate-delay', row: 1, index: 1 },
            { id: 'env', type: 'adsr', row: 1, index: 2 },
            { id: 'vco', type: 'vco', row: 2, index: 0 },
            { id: 'vca', type: 'vca', row: 2, index: 1 },
            { id: 'out', type: 'out', row: 2, index: 2 }
        ],
        params: {
            clk: { rate: 0.28, pause: 0 },
            delay: { delay1: 0.34, length1: 0.25, delay2: 0.55, length2: 0.2 },
            env: { attack: 0, decay: 0.25, sustain: 0.35, release: 0.45 },
            vco: { coarse: 0.3, fine: 0, glide: 0 },
            vca: { ch1Gain: 0.75, ch2Gain: 0 },
            out: { volume: 0.62 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'delay', toPort: 'trig1' },
            { fromModule: 'delay', fromPort: 'gate1', toModule: 'env', toPort: 'gate' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'env', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
