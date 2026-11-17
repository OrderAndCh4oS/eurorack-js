// A repeating B / t / Pf / t percussion pattern. SEQ's CV and gate change on
// the same sample. External envelope bends Tune; LFO varies Decay/Accent.
// Wrap makes turning Sound transpose the pattern around the full sound bank.
export default {
    name: 'Test - Beatbox',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clock', type: 'clk', row: 1, index: 0 },
            { id: 'sounds', type: 'seq', row: 1, index: 1 },
            { id: 'accents', type: 'lfo', row: 1, index: 2 },
            { id: 'bend', type: 'func', row: 1, index: 3 },
            { id: 'depth', type: 'atten', row: 1, index: 4 },
            { id: 'beatbox', type: 'beatbox', row: 1, index: 5 },
            { id: 'out', type: 'out', row: 1, index: 6 }
        ],
        params: {
            clock: { rate: 0.32, pause: 0 },
            sounds: {
                // CV is 0..4 V; use the middle of each half-volt sound bin.
                step1: 0, step2: 0.15625, step3: 0.40625, step4: 0.15625,
                step5: 0, step6: 0.15625, step7: 0.40625, step8: 0.15625,
                length: 8, range: 2, direction: 0,
                gate1: 1, gate2: 1, gate3: 1, gate4: 1,
                gate5: 1, gate6: 1, gate7: 1, gate8: 1
            },
            accents: { rateKnob: 0.25, waveKnob: 0, range: 0 },
            beatbox: {
                pitch: -4, shape: 0, sound: 0, decay: 1, snap: .6, wrap: 1,
                pressure: 8, breath: 0.15, level: 0.7
            },
            bend: { rise: 0, fall: .25, curve: .35, cycle: 0 },
            depth: { atten1: .525, offset1: .5, atten2: .65, offset2: .4 },
            out: { volume: 0.6 }
        },
        cables: [
            { fromModule: 'clock', fromPort: 'clock', toModule: 'sounds', toPort: 'clock' },
            { fromModule: 'sounds', fromPort: 'cv', toModule: 'beatbox', toPort: 'soundCV' },
            { fromModule: 'sounds', fromPort: 'gate', toModule: 'beatbox', toPort: 'trig' },
            { fromModule: 'accents', fromPort: 'primary', toModule: 'beatbox', toPort: 'accent' },
            { fromModule: 'sounds', fromPort: 'gate', toModule: 'bend', toPort: 'trig' },
            { fromModule: 'bend', fromPort: 'out', toModule: 'depth', toPort: 'in1' },
            { fromModule: 'depth', fromPort: 'out1', toModule: 'beatbox', toPort: 'vOct' },
            { fromModule: 'accents', fromPort: 'secondary', toModule: 'depth', toPort: 'in2' },
            { fromModule: 'depth', fromPort: 'out2', toModule: 'beatbox', toPort: 'decayCV' },
            { fromModule: 'beatbox', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'beatbox', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
