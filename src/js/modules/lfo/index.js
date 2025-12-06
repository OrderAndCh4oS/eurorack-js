/**
 * LFO - Eight-wave VC LFO (DIGITAL CLONE)
 *
 * Unipolar 0→5V outputs.
 * Reset triggers on ≥1V rising edge.
 *
 * Params:
 *   range: 0 = slow (27s to 20Hz), 1 = fast (3.3s to 152Hz)
 *   rateKnob: 0→1 (exponential)
 *   waveKnob: 0→1 (morph between 4 waveforms)
 */

import { clamp, expMap } from '../../utils/math.js';

export default {
    id: 'lfo',
    name: 'LFO',
    hp: 4,
    color: '#2d5a27',
    category: 'modulation',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const TWO_PI = 2 * Math.PI;
        const slow = { min: 1 / 27, max: 20 };
        const fast = { min: 1 / 3.3, max: 152 };

        // Four-shape cross-fade banks
        const primary = [
            t => Math.sin(TWO_PI * t),
            t => 2 * Math.abs(2 * (t - 0.5)) - 1,
            t => 2 * t - 1,
            t => (t < 0.5 ? 1 : -1)
        ];
        const secondary = [
            t => Math.abs(Math.sin(TWO_PI * t)) - Math.abs(Math.cos(TWO_PI * t)),
            t => Math.sin(TWO_PI * t) * Math.sin(4 * TWO_PI * t),
            t => 1 - 2 * t,
            t => {
                const x = primary[1](t);
                return Math.round((x + 1) * 2) / 2 - 1;
            }
        ];

        let phase = 0;
        let lastResetGate = 0;
        const outA = new Float32Array(bufferSize);
        const outB = new Float32Array(bufferSize);

        return {
            params: {
                range: 0,
                rateKnob: 0.75,
                waveKnob: 0
            },

            inputs: {
                rateCV: new Float32Array(bufferSize),
                waveCV: new Float32Array(bufferSize),
                reset: new Float32Array(bufferSize)
            },

            outputs: {
                primary: outA,
                secondary: outB
            },

            leds: {},

            process() {
                const rng = this.params.range ? fast : slow;
                const fBase = expMap(this.params.rateKnob, rng.min, rng.max);

                // Use first sample of CV for simplicity (per-sample would be more accurate)
                const cvOct = clamp(this.inputs.rateCV[0] || 0, 0, 5);
                const freq = fBase * 2 ** cvOct;
                const inc = freq / sampleRate;

                const waveCVVal = this.inputs.waveCV[0] || 0;
                const wNorm = clamp(this.params.waveKnob + waveCVVal / 5);
                const pos = wNorm * 4;
                const idx = Math.floor(pos) & 3;
                const frac = pos - Math.floor(pos);
                const next = (idx + 1) & 3;
                const a1 = primary[idx], a2 = primary[next];
                const b1 = secondary[idx], b2 = secondary[next];

                // Reset on rising edge
                const resetVal = this.inputs.reset[0] || 0;
                if (resetVal >= 1 && lastResetGate < 1) phase = 0;
                lastResetGate = resetVal;

                for (let i = 0; i < bufferSize; i++) {
                    phase = (phase + inc) % 1;
                    const t = phase;
                    const prim = (1 - frac) * a1(t) + frac * a2(t);
                    const sec = (1 - frac) * b1(t) + frac * b2(t);
                    outA[i] = (prim + 1) * 2.5;
                    outB[i] = (sec + 1) * 2.5;
                }
            },

            reset() {
                phase = 0;
                lastResetGate = 0;
                outA.fill(0);
                outB.fill(0);
            }
        };
    },

    ui: {
        knobs: [
            { id: 'rateKnob', label: 'Rate', param: 'rateKnob', min: 0, max: 1, default: 0.3 },
            { id: 'waveKnob', label: 'Wave', param: 'waveKnob', min: 0, max: 1, default: 0 }
        ],
        switches: [
            { id: 'range', label: 'Fast', param: 'range', default: 0 }
        ],
        inputs: [
            { id: 'rateCV', label: 'Rate', port: 'rateCV', type: 'cv' },
            { id: 'waveCV', label: 'Wave', port: 'waveCV', type: 'cv' },
            { id: 'reset', label: 'Reset', port: 'reset', type: 'trigger' }
        ],
        outputs: [
            { id: 'primary', label: 'Pri', port: 'primary', type: 'buffer' },
            { id: 'secondary', label: 'Sec', port: 'secondary', type: 'buffer' }
        ]
    }
};
