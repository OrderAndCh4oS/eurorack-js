import { clamp, expMap } from '../utils/math.js';

/**
 * 2HP LFO – Eight-wave VC LFO (DIGITAL CLONE)
 *
 * Unipolar 0→5 V outputs.
 * inputs.reset triggers on ≥1 V rising edge.
 *
 * Params:
 *   range: 0 = slow (27s to 20Hz), 1 = fast (3.3s to 152Hz)
 *   rateKnob: 0→1 (exponential)
 *   waveKnob: 0→1 (morph between 4 waveforms)
 *
 * Inputs:
 *   rateCV: 0→5V (1V/oct, adds up to +5 octaves)
 *   waveCV: 0→5V (linear morph addition)
 *   reset: ≥1V rising edge = hard sync
 *
 * Outputs:
 *   primary: 0→5V (morph bank A: sine, triangle, saw, square)
 *   secondary: 0→5V (morph bank B: folded waveforms)
 *
 * @param {Object} options
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @returns {Object} LFO module with params, inputs, outputs, and process()
 */
export function create2hpLFO({ sampleRate = 44100, bufferSize = 512 } = {}) {
    const TWO_PI = 2 * Math.PI;
    const slow = { min: 1 / 27, max: 20 };      // 27s → 20 Hz (per 2HP specs)
    const fast = { min: 1 / 3.3, max: 152 };    // 3.3s → 152 Hz (per 2HP specs)

    /* Four-shape cross-fade banks */
    const primary = [
        t => Math.sin(TWO_PI * t),                      // Sine
        t => 2 * Math.abs(2 * (t - 0.5)) - 1,          // Triangle
        t => 2 * t - 1,                                 // Ramp (saw)
        t => (t < 0.5 ? 1 : -1)                        // Square
    ];
    const secondary = [
        t => Math.abs(Math.sin(TWO_PI * t)) - Math.abs(Math.cos(TWO_PI * t)),
        t => Math.sin(TWO_PI * t) * Math.sin(4 * TWO_PI * t),
        t => 1 - 2 * t,                                // Inverted ramp
        t => {
            const x = primary[1](t);
            return Math.round((x + 1) * 2) / 2 - 1;    // Stepped triangle
        }
    ];

    let phase = 0;
    let lastResetGate = 0;
    const outA = new Float32Array(bufferSize);
    const outB = new Float32Array(bufferSize);

    return {
        params: { range: 0, rateKnob: 0.75, waveKnob: 0 },
        inputs: { rateCV: 0, waveCV: 0, reset: 0 },
        outputs: { primary: outA, secondary: outB },

        process() {
            const rng = this.params.range ? fast : slow;
            const fBase = expMap(this.params.rateKnob, rng.min, rng.max);
            const cvOct = clamp(this.inputs.rateCV, 0, 5);
            const freq = fBase * 2 ** cvOct;
            const inc = freq / sampleRate;

            const wNorm = clamp(this.params.waveKnob + this.inputs.waveCV / 5);
            const pos = wNorm * 4;
            const idx = Math.floor(pos) & 3;
            const frac = pos - Math.floor(pos);
            const next = (idx + 1) & 3;
            const a1 = primary[idx], a2 = primary[next];
            const b1 = secondary[idx], b2 = secondary[next];

            // Reset on rising edge
            if (this.inputs.reset >= 1 && lastResetGate < 1) phase = 0;
            lastResetGate = this.inputs.reset;

            for (let i = 0; i < bufferSize; i++) {
                phase = (phase + inc) % 1;
                const t = phase;
                const prim = (1 - frac) * a1(t) + frac * a2(t);
                const sec = (1 - frac) * b1(t) + frac * b2(t);
                outA[i] = (prim + 1) * 2.5; // 0→5V
                outB[i] = (sec + 1) * 2.5;
            }
        }
    };
}
