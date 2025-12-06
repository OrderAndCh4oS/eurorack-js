/**
 * VCO - CEM3340 Analogue Oscillator (±5V outputs)
 *
 * Features:
 * - PolyBLEP anti-aliasing for sawtooth and pulse waves
 * - Capacitor-smoothed pitch CV (configurable glide/portamento)
 * - Hard sync input
 * - FM input
 * - PWM input
 */

import { clamp, expMap } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';

export default {
    id: 'vco',
    name: 'VCO',
    hp: 4,
    color: '#8b4513',
    category: 'source',

    createDSP({ sampleRate = 44100, bufferSize = 512, fmVoltsPerHz = 200 } = {}) {
        const coarseHz = { min: 4.3, max: 22000 };
        let phase = 0;
        let lastSync = 0;
        const tri = new Float32Array(bufferSize);
        const saw = new Float32Array(bufferSize);
        const sqr = new Float32Array(bufferSize);

        const pitchSlew = createSlew({ sampleRate, timeMs: 5 });
        const pwmSlew = createSlew({ sampleRate, timeMs: 2 });

        function polyBlep(t, dt) {
            if (t < dt) {
                const x = t / dt;
                return x + x - x * x - 1;
            } else if (t > 1 - dt) {
                const x = (t - 1) / dt;
                return x * x + x + x + 1;
            }
            return 0;
        }

        return {
            params: { coarse: 0.4, fine: 0, glide: 5 },
            inputs: {
                vOct: new Float32Array(bufferSize),
                fm: new Float32Array(bufferSize),
                pwm: new Float32Array(bufferSize),
                sync: new Float32Array(bufferSize)
            },
            outputs: { triangle: tri, ramp: saw, pulse: sqr },
            leds: {},

            process() {
                const base = expMap(this.params.coarse, coarseHz.min, coarseHz.max);
                pitchSlew.timeMs = Math.max(0.1, this.params.glide);

                for (let i = 0; i < bufferSize; i++) {
                    const vOctVal = this.inputs.vOct[i] || 0;
                    const fmVal = this.inputs.fm[i] || 0;
                    const pwmVal = this.inputs.pwm[i] || 2.5;
                    const syncVal = this.inputs.sync[i] || 0;

                    const targetDuty = 0.05 + clamp(pwmVal, 0, 5) / 5 * 0.90;
                    const smoothedVOct = pitchSlew.process(vOctVal);
                    const smoothedDuty = pwmSlew.process(targetDuty);

                    const freq = Math.max(0, base * 2 ** smoothedVOct * 2 ** (this.params.fine / 12) + fmVal * fmVoltsPerHz);
                    const inc = freq / sampleRate;

                    if (lastSync <= 0 && syncVal > 0) phase = 0;
                    lastSync = syncVal;
                    phase = (phase + inc) % 1;
                    const t = phase;

                    let sawVal = 2 * t - 1;
                    let sqrVal = t < smoothedDuty ? 1 : -1;

                    sawVal -= polyBlep(t, inc);
                    sqrVal += polyBlep(t, inc);
                    sqrVal -= polyBlep((t + 1 - smoothedDuty) % 1, inc);

                    tri[i] = (4 * Math.abs(t - 0.5) - 1) * 5;
                    saw[i] = sawVal * 5;
                    sqr[i] = sqrVal * 5;
                }
            },

            reset() {
                phase = 0;
                lastSync = 0;
                tri.fill(0);
                saw.fill(0);
                sqr.fill(0);
            }
        };
    },

    ui: {
        knobs: [
            { id: 'coarse', label: 'Coarse', param: 'coarse', min: 0, max: 1, default: 0.4 },
            { id: 'fine', label: 'Fine', param: 'fine', min: -6, max: 6, default: 0 },
            { id: 'glide', label: 'Glide', param: 'glide', min: 0, max: 100, default: 5 }
        ],
        inputs: [
            { id: 'vOct', label: 'V/Oct', port: 'vOct', type: 'cv' },
            { id: 'fm', label: 'FM', port: 'fm', type: 'cv' },
            { id: 'pwm', label: 'PWM', port: 'pwm', type: 'cv' },
            { id: 'sync', label: 'Sync', port: 'sync', type: 'trigger' }
        ],
        outputs: [
            { id: 'triangle', label: 'Tri', port: 'triangle', type: 'buffer' },
            { id: 'ramp', label: 'Saw', port: 'ramp', type: 'buffer' },
            { id: 'pulse', label: 'Pls', port: 'pulse', type: 'buffer' }
        ]
    }
};
