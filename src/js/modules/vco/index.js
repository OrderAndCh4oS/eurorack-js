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
import { polyBlep, wrapPhase } from '../../utils/oscillator.js';
import { createSlew } from '../../utils/slew.js';
import { softLimitVoltage } from '../../utils/voltage.js';

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

export default {
    id: 'vco',
    name: 'VCO',
    hp: 4,
    color: 'module-color-six',
    category: 'source',

    createDSP({ sampleRate = 44100, bufferSize = 512, fmVoltsPerHz = 200 } = {}) {
        const coarseHz = { min: 4.3, max: 22000 };
        let phase = 0;
        let lastSync = 0;
        const tri = new Float32Array(bufferSize);
        const saw = new Float32Array(bufferSize);
        const sqr = new Float32Array(bufferSize);
        const ownVOct = new Float32Array(bufferSize);
        const ownFM = new Float32Array(bufferSize);
        const ownPWM = new Float32Array(bufferSize).fill(2.5);
        const ownSync = new Float32Array(bufferSize);

        const pitchSlew = createSlew({ sampleRate, timeMs: 5 });
        const pwmSlew = createSlew({ sampleRate, timeMs: 2 });
        pwmSlew.reset(0.5);

        return {
            params: { coarse: 0.4, fine: 0, glide: 5 },
            inputs: {
                vOct: ownVOct,
                fm: ownFM,
                pwm: ownPWM,
                sync: ownSync
            },
            outputs: { triangle: tri, ramp: saw, pulse: sqr },
            leds: {},

            process() {
                const base = expMap(finite(this.params.coarse, 0.4), coarseHz.min, coarseHz.max);
                const fine = finite(this.params.fine);
                pitchSlew.timeMs = Math.max(0.1, finite(this.params.glide, 5));

                for (let i = 0; i < bufferSize; i++) {
                    const vOctVal = clamp(finite(this.inputs.vOct[i]), -8, 8);
                    const fmVal = finite(this.inputs.fm[i]);
                    const pwmVal = finite(this.inputs.pwm[i], 2.5);
                    const syncVal = finite(this.inputs.sync[i]);

                    const targetDuty = 0.05 + clamp(pwmVal, 0, 5) / 5 * 0.90;
                    const smoothedVOct = pitchSlew.process(vOctVal);
                    const smoothedDuty = pwmSlew.process(targetDuty);

                    const requestedFreq = base * 2 ** smoothedVOct * 2 ** (fine / 12) + fmVal * fmVoltsPerHz;
                    const freq = clamp(requestedFreq, 0, sampleRate * 0.45);
                    const inc = freq / sampleRate;

                    const syncHigh = syncVal >= 1;
                    if (lastSync < 1 && syncHigh) phase = 0;
                    lastSync = syncHigh ? 1 : 0;
                    phase = wrapPhase(phase + inc);
                    const t = phase;

                    let sawVal = 2 * t - 1;
                    let sqrVal = t < smoothedDuty ? 1 : -1;

                    sawVal -= polyBlep(t, inc);
                    sqrVal += polyBlep(t, inc);
                    sqrVal -= polyBlep(wrapPhase(t - smoothedDuty), inc);

                    tri[i] = softLimitVoltage((4 * Math.abs(t - 0.5) - 1) * 5, 5);
                    saw[i] = softLimitVoltage(sawVal * 5, 5);
                    sqr[i] = softLimitVoltage(sqrVal * 5, 5);
                }
            },

            reset() {
                phase = 0;
                lastSync = 0;
                tri.fill(0);
                saw.fill(0);
                sqr.fill(0);
                ownVOct.fill(0);
                ownFM.fill(0);
                ownPWM.fill(2.5);
                ownSync.fill(0);
                pitchSlew.reset(0);
                pwmSlew.reset(0.5);
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
            { id: 'vOct', label: 'V/Oct', port: 'vOct', signal: 'cv', voltage: { min: -8, max: 8, normal: 0 } },
            { id: 'fm', label: 'FM', port: 'fm', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'pwm', label: 'PWM', port: 'pwm', signal: 'cv', voltage: { min: 0, max: 5, normal: 2.5 } },
            { id: 'sync', label: 'Sync', port: 'sync', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'triangle', label: 'Tri', port: 'triangle', signal: 'audio' },
            { id: 'ramp', label: 'Saw', port: 'ramp', signal: 'audio' },
            { id: 'pulse', label: 'Pls', port: 'pulse', signal: 'audio' }
        ]
    }
};
