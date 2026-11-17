// Internal regression fixture. The user-facing Pro demo was withdrawn after audition.
// Ten sounds remain externally addressed; Wrap allows bank transposition.
// A patched FUNC bends Tune. Slow CV moves noise/nasal coupling and tongue.
export default {
    name: 'Beatbox Pro browser fixture', factory: false,
    state: {
        version: 3, plugins: { core: 1 },
        modules: [
            { id: 'clock', type: 'clk', row: 1, index: 0 },
            { id: 'sounds', type: 'seq', row: 1, index: 1 },
            { id: 'range', type: 'mix', row: 1, index: 2 },
            { id: 'motion', type: 'lfo', row: 1, index: 3 },
            { id: 'colour', type: 'atten', row: 1, index: 4 },
            { id: 'bend', type: 'func', row: 1, index: 5 },
            { id: 'depth', type: 'atten', row: 1, index: 6 },
            { id: 'beatboxPro', type: 'beatbox-pro', row: 1, index: 7 },
            { id: 'out', type: 'out', row: 1, index: 8 }
        ],
        params: {
            clock: { rate: .31 },
            sounds: {
                length: 8, range: 2, direction: 0,
                step1: .025, step2: .125, step3: .325, step4: .125,
                step5: .025, step6: .225, step7: .925, step8: .325
            },
            range: { lvl1: 1, lvl2: .25, lvl3: 0, lvl4: 0 },
            motion: { rateKnob: .12, waveKnob: 0, range: 0 },
            colour: { atten1: .6, offset1: .5, atten2: .6, offset2: .4 },
            bend: { rise: 0, fall: .27, curve: .35, cycle: 0 },
            depth: { atten1: .525, offset1: .5, atten2: .55, offset2: .5 },
            beatboxPro: { pitch: -3, decay: 1.15, snap: .6, wrap: 1, noise: 1.1, throat: .12, level: .75 },
            out: { volume: .5 }
        },
        cables: [
            { fromModule: 'clock', fromPort: 'clock', toModule: 'sounds', toPort: 'clock' },
            { fromModule: 'sounds', fromPort: 'cv', toModule: 'range', toPort: 'in1' },
            { fromModule: 'sounds', fromPort: 'cv', toModule: 'range', toPort: 'in2' },
            { fromModule: 'range', fromPort: 'out', toModule: 'beatboxPro', toPort: 'soundCV' },
            { fromModule: 'sounds', fromPort: 'gate', toModule: 'beatboxPro', toPort: 'trig' },
            { fromModule: 'sounds', fromPort: 'gate', toModule: 'bend', toPort: 'trig' },
            { fromModule: 'bend', fromPort: 'out', toModule: 'depth', toPort: 'in1' },
            { fromModule: 'depth', fromPort: 'out1', toModule: 'beatboxPro', toPort: 'vOct' },
            { fromModule: 'motion', fromPort: 'primary', toModule: 'colour', toPort: 'in1' },
            { fromModule: 'motion', fromPort: 'secondary', toModule: 'colour', toPort: 'in2' },
            { fromModule: 'colour', fromPort: 'out1', toModule: 'beatboxPro', toPort: 'noiseCV' },
            { fromModule: 'colour', fromPort: 'out1', toModule: 'beatboxPro', toPort: 'nasalCV' },
            { fromModule: 'colour', fromPort: 'out2', toModule: 'beatboxPro', toPort: 'tongueCV' },
            { fromModule: 'motion', fromPort: 'secondary', toModule: 'depth', toPort: 'in2' },
            { fromModule: 'depth', fromPort: 'out2', toModule: 'beatboxPro', toPort: 'snapCV' },
            { fromModule: 'colour', fromPort: 'out1', toModule: 'beatboxPro', toPort: 'decayCV' },
            { fromModule: 'motion', fromPort: 'primary', toModule: 'beatboxPro', toPort: 'accent' },
            { fromModule: 'beatboxPro', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'beatboxPro', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
