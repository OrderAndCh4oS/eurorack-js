export default {
    name: 'Test - Octo Cable Snake',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'tone', type: 'vco', row: 1, index: 0 },
            { id: 'clock', type: 'clk', row: 1, index: 1 },
            { id: 'sender', type: 'octo-send', row: 1, index: 2 },
            { id: 'receiver', type: 'octo-receive', row: 2, index: 0 },
            { id: 'kick', type: 'kick', row: 2, index: 1 },
            { id: 'out', type: 'out', row: 2, index: 2 }
        ],
        params: {
            tone: { coarse: 0.4, fine: 0 },
            clock: { rate: 0.26 },
            out: { volume: 0.35 }
        },
        cables: [
            { fromModule: 'tone', fromPort: 'triangle', toModule: 'sender', toPort: 'in1' },
            { fromModule: 'clock', fromPort: 'clock', toModule: 'sender', toPort: 'in8' },
            { fromModule: 'sender', fromPort: 'link', toModule: 'receiver', toPort: 'link' },
            { fromModule: 'receiver', fromPort: 'out1', toModule: 'out', toPort: 'L' },
            { fromModule: 'receiver', fromPort: 'out8', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
