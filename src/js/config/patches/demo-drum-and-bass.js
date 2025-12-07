/**
 * Demo - Drum and Bass
 * Fast breakbeat-style drums with synced arpeggiator bass line
 */
export default {
    name: 'Demo - Drum and Bass',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div1', row: 1 },
            { type: 'div', instanceId: 'div2', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'snare', instanceId: 'snare', row: 1 },
            { type: 'hat', instanceId: 'hat', row: 1 },
            { type: 'arp', instanceId: 'arp', row: 1 },
            { type: 'quant', instanceId: 'quant', row: 1 },
            { type: 'vco', instanceId: 'bass', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'mix', instanceId: 'drums', row: 1 },
            { type: 'mix', instanceId: 'master', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 },
            { type: 'div', instanceId: 'div3', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.38666666666666666 },
            div1: { rate1: 0.2933333333333332, rate2: 0.3983333333333333 },
            div2: { rate1: 0.5333333333333332, rate2: 0.5866666666666668 },
            div3: { rate1: 0.44999999999999996, rate2: 0.21999999999999997 },
            kick: { pitch: 0.35, decay: 0.4, tone: 0.3 },
            snare: { snap: 0.7, decay: 0.35, pitch: 0.55 },
            hat: { decay: 0.13333333333333336, sizzle: 0.33999999999999997, blend: 0.3 },
            arp: { root: 6, chord: 5, mode: 2 },
            quant: { scale: 2, octave: -1, semitone: 0 },
            bass: { coarse: 0.3033333333333334, fine: 0.96, glide: 0.6666666666666661 },
            vcf: { cutoff: 0.5266666666666667, resonance: 0.6466666666666666 },
            vca: { ch1Gain: 0.9, ch2Gain: 0.9 },
            drums: { lvl1: 0.6933333333333334, lvl2: 0.8466666666666667, lvl3: 0.38, lvl4: 0 },
            master: { lvl1: 0.16666666666666666, lvl2: 0.22, lvl3: 0, lvl4: 0 },
            out: { volume: 0.7 }
        },
        switches: {
            clk: { pause: false },
            arp: { octaves: true }
        },
        buttons: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div1', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div2', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div3', toPort: 'clock' },
            { fromModule: 'div1', fromPort: 'out1', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'div1', fromPort: 'out2', toModule: 'snare', toPort: 'trigger' },
            { fromModule: 'div2', fromPort: 'out1', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'div2', fromPort: 'out2', toModule: 'hat', toPort: 'trigOpen' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'drums', toPort: 'in1' },
            { fromModule: 'snare', fromPort: 'out', toModule: 'drums', toPort: 'in2' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'drums', toPort: 'in3' },
            { fromModule: 'div3', fromPort: 'out1', toModule: 'arp', toPort: 'trigger' },
            { fromModule: 'arp', fromPort: 'cv', toModule: 'quant', toPort: 'cv' },
            { fromModule: 'quant', fromPort: 'cv', toModule: 'bass', toPort: 'vOct' },
            { fromModule: 'bass', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'drums', fromPort: 'out', toModule: 'master', toPort: 'in1' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'master', toPort: 'in2' },
            { fromModule: 'master', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'master', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
