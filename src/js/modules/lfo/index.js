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
import { wrapPhase } from '../../utils/oscillator.js';

export default {
    id: 'lfo',
    name: 'LFO',
    hp: 4,
    color: 'module-color-four',
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
        const rateCV = new Float32Array(bufferSize);
        const waveCV = new Float32Array(bufferSize);
        const resetInput = new Float32Array(bufferSize);
        const outA = new Float32Array(bufferSize);
        const outB = new Float32Array(bufferSize);

        return {
            params: {
                range: 0,
                rateKnob: 0.3,
                waveKnob: 0
            },

            inputs: {
                rateCV,
                waveCV,
                reset: resetInput
            },

            outputs: {
                primary: outA,
                secondary: outB
            },

            leds: {},

            process() {
                const rangeFast = this.params.range === 1 || this.params.range === true;
                const rng = rangeFast ? fast : slow;
                const rateKnob = Number.isFinite(this.params.rateKnob)
                    ? clamp(this.params.rateKnob, 0, 1)
                    : 0.3;
                const waveKnob = Number.isFinite(this.params.waveKnob)
                    ? clamp(this.params.waveKnob, 0, 1)
                    : 0;
                const fBase = expMap(rateKnob, rng.min, rng.max);

                for (let i = 0; i < bufferSize; i++) {
                    const resetVal = Number.isFinite(resetInput[i]) ? resetInput[i] : 0;
                    if (resetVal >= 1 && lastResetGate < 1) phase = 0;
                    lastResetGate = resetVal;

                    const waveCVVal = Number.isFinite(waveCV[i]) ? waveCV[i] : 0;
                    const wNorm = clamp(waveKnob + clamp(waveCVVal, 0, 5) / 5, 0, 1);
                    const pos = wNorm * (primary.length - 1);
                    const idx = Math.floor(pos);
                    const frac = pos - idx;
                    const next = Math.min(idx + 1, primary.length - 1);
                    const a1 = primary[idx];
                    const a2 = primary[next];
                    const b1 = secondary[idx];
                    const b2 = secondary[next];

                    const t = phase;
                    const prim = (1 - frac) * a1(t) + frac * a2(t);
                    const sec = (1 - frac) * b1(t) + frac * b2(t);
                    outA[i] = (prim + 1) * 2.5;
                    outB[i] = (sec + 1) * 2.5;

                    const cvOct = Number.isFinite(rateCV[i])
                        ? clamp(rateCV[i], 0, 5)
                        : 0;
                    phase = wrapPhase(phase + fBase * 2 ** cvOct / sampleRate);
                }
            },

            reset() {
                phase = 0;
                lastResetGate = 0;
                rateCV.fill(0);
                waveCV.fill(0);
                resetInput.fill(0);
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
            { id: 'rateCV', label: 'Rate', port: 'rateCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
            { id: 'waveCV', label: 'Wave', port: 'waveCV', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'primary', label: 'Pri', port: 'primary', signal: 'cv', voltage: { min: 0, max: 5 } },
            { id: 'secondary', label: 'Sec', port: 'secondary', signal: 'cv', voltage: { min: 0, max: 5 } }
        ]
    }
};
