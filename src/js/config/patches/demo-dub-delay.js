/**
 * Demo - Dub Delay
 * Classic dub-style delay with tempo-synced echoes.
 * Features rich feedback and mixing for spacious sound.
 */
export default {
    name: 'Demo - Dub Delay',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'seq', instanceId: 'seq', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'dly', instanceId: 'dly', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.31 },
            div: { rate1: 0.5, rate2: 0.5 },
            seq: {
                step1: 0.2, step2: 0.4, step3: 0.3, step4: 0.5,
                step5: 0.2, step6: 0.6, step7: 0.4, step8: 0.3,
                length: 8, range: 1, direction: 0
            },
            vco: { coarse: 0.3, fine: 0.5, glide: 0.15 },
            vcf: { cutoff: 0.55, resonance: 0.35 },
            vca: { ch1Gain: 0, ch2Gain: 0.75 },
            adsr: { attack: 0.02, decay: 0.35, sustain: 0.3, release: 0.61 },
            dly: { time: 0.61, feedback: 0.43, mix: 0.59 },
            mix: { lvl1: 0.8, lvl2: 0.8, lvl3: 0.8, lvl4: 0.8 },
            out: { volume: 0.55 }
        },
        switches: {
            clk: { pause: false }
        },
        buttons: {
            seq: {
                gate1: 1, gate2: 1, gate3: 0, gate4: 1,
                gate5: 1, gate6: 0, gate7: 1, gate8: 0
            }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'seq', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'seq', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'seq', fromPort: 'gate', toModule: 'adsr', toPort: 'gate' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vcf', toPort: 'cutoffCV' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch2In' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'dly', toPort: 'audio' },
            { fromModule: 'dly', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
