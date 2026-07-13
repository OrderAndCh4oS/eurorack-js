/**
 * Demo - Round Robin - Alternating Voices
 *
 * A seven-note sequence alternates between two independently shaped voices.
 * The odd sequence length swaps each note's assigned voice on every loop.
 * A sequential switch distributes pitch, while complementary two-step trigger
 * patterns clock the matching sample-and-hold channel and envelope.
 *
 * Inspired by Monotrail Tech Talk's round-robin synthesis walkthrough:
 * https://www.youtube.com/watch?v=MPqGKBMWc9c
 */
export default {
    name: 'Demo - Round Robin - Alternating Voices',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clk', type: 'clk', row: 1, index: 0 },
            { id: 'seq', type: 'seq', row: 1, index: 1 },
            { id: 'pitchRoute', type: 'seq-switch', row: 1, index: 2 },
            { id: 'gateA', type: 'euclid', row: 1, index: 3 },
            { id: 'gateB', type: 'euclid', row: 1, index: 4 },
            { id: 'pitchHold', type: 'sh', row: 1, index: 5 },
            { id: 'envA', type: 'adsr', row: 2, index: 0 },
            { id: 'vcoA', type: 'vco', row: 2, index: 1 },
            { id: 'lpgA', type: 'lpg', row: 2, index: 2 },
            { id: 'envB', type: 'adsr', row: 2, index: 3 },
            { id: 'vcoB', type: 'vco', row: 2, index: 4 },
            { id: 'lpgB', type: 'lpg', row: 2, index: 5 },
            { id: 'voices', type: 'mix', row: 2, index: 6 },
            { id: 'out', type: 'out', row: 2, index: 7 }
        ],
        params: {
            clk: { rate: 0.26, pause: 0 },
            seq: {
                step1: 0,
                step2: 0.25,
                step3: 0.5,
                step4: 0.125,
                step5: 0.625,
                step6: 0.375,
                step7: 0.75,
                step8: 0,
                length: 7,
                range: 0,
                direction: 0,
                gate1: 1,
                gate2: 1,
                gate3: 1,
                gate4: 1,
                gate5: 1,
                gate6: 1,
                gate7: 1,
                gate8: 0
            },
            pitchRoute: { steps: 2 },
            gateA: { length: 2, hits: 1, rotate: 1 },
            gateB: { length: 2, hits: 1, rotate: 0 },
            pitchHold: { slew1: 0.015, slew2: 0.04 },
            envA: { attack: 0, decay: 0.34666666666666673, sustain: 0.04, release: 0.64 },
            vcoA: { coarse: 0.27, fine: -0.08, glide: 0 },
            lpgA: { level: 0, damp: 0.28, tone: 0.5, resonance: 0.08, mode: 1 },
            envB: { attack: 0.035, decay: 0.5, sustain: 0.18, release: 0.72 },
            vcoB: { coarse: 0.35, fine: 0.08, glide: 0 },
            lpgB: { level: 0, damp: 0.58, tone: 0.78, resonance: 0.18, mode: 1 },
            voices: { lvl1: 0.72, lvl2: 0.58, lvl3: 0, lvl4: 0 },
            out: { volume: 0.64 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'seq', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'pitchRoute', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'gateA', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'gateB', toPort: 'clock' },
            { fromModule: 'seq', fromPort: 'cv', toModule: 'pitchRoute', toPort: 'commonIn' },
            { fromModule: 'pitchRoute', fromPort: 'out1', toModule: 'pitchHold', toPort: 'in1' },
            { fromModule: 'pitchRoute', fromPort: 'out2', toModule: 'pitchHold', toPort: 'in2' },
            { fromModule: 'gateA', fromPort: 'trig', toModule: 'pitchHold', toPort: 'trig1' },
            { fromModule: 'gateB', fromPort: 'trig', toModule: 'pitchHold', toPort: 'trig2' },
            { fromModule: 'gateA', fromPort: 'trig', toModule: 'envA', toPort: 'gate' },
            { fromModule: 'gateB', fromPort: 'trig', toModule: 'envB', toPort: 'gate' },
            { fromModule: 'pitchHold', fromPort: 'out1', toModule: 'vcoA', toPort: 'vOct' },
            { fromModule: 'pitchHold', fromPort: 'out2', toModule: 'vcoB', toPort: 'vOct' },
            { fromModule: 'vcoA', fromPort: 'ramp', toModule: 'lpgA', toPort: 'audio' },
            { fromModule: 'envA', fromPort: 'env', toModule: 'lpgA', toPort: 'cv' },
            { fromModule: 'vcoB', fromPort: 'pulse', toModule: 'lpgB', toPort: 'audio' },
            { fromModule: 'envB', fromPort: 'env', toModule: 'lpgB', toPort: 'cv' },
            { fromModule: 'lpgA', fromPort: 'out', toModule: 'voices', toPort: 'in1' },
            { fromModule: 'lpgB', fromPort: 'out', toModule: 'voices', toPort: 'in2' },
            { fromModule: 'voices', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'voices', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
