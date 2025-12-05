import { clamp, expMap } from '../utils/math.js';

/**
 * 2HP VCO – CEM3340 Analogue Oscillator (±5V outputs)
 *
 * Features:
 * - PolyBLEP anti-aliasing for sawtooth and pulse waves
 * - Capacitor-smoothed pitch CV (configurable glide/portamento)
 * - Hard sync input
 * - FM input
 * - PWM input
 *
 * Params:
 *   coarse: 0→1 (exponential, 4.3Hz to 22kHz)
 *   fine: -6 to +6 semitones
 *   glide: 0-100ms portamento time
 *
 * Inputs:
 *   vOct: 1V/octave pitch CV
 *   fm: Linear FM (200Hz per volt)
 *   pwm: Pulse width (0-5V = 5%-95%)
 *   sync: Hard sync trigger
 *
 * Outputs:
 *   triangle: ±5V
 *   ramp: ±5V (sawtooth)
 *   pulse: ±5V
 *
 * @param {Object} options
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @param {number} options.fmVoltsPerHz - FM sensitivity (default: 200)
 * @returns {Object} VCO module
 */
export function create2hpVCO({ sampleRate = 44100, bufferSize = 512, fmVoltsPerHz = 200 } = {}) {
    const coarseHz = { min: 4.3, max: 22000 };
    let phase = 0;
    let lastSync = 0;
    const tri = new Float32Array(bufferSize);
    const saw = new Float32Array(bufferSize);
    const sqr = new Float32Array(bufferSize);

    /* CV smoothing state */
    let pitchState = 0;
    let pwmState = 0;
    const pwmCoeff = 1 - Math.exp(-1000 / (sampleRate * 2)); /* 2ms for PWM */

    /**
     * PolyBLEP: softens discontinuities to reduce aliasing
     */
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
        inputs: { vOct: 0, fm: 0, pwm: 2.5, sync: 0 },
        outputs: { triangle: tri, ramp: saw, pulse: sqr },

        process() {
            const base = expMap(this.params.coarse, coarseHz.min, coarseHz.max);
            const targetDuty = 0.05 + clamp(this.inputs.pwm, 0, 5) / 5 * 0.90;
            /* Dynamic glide coefficient based on glide param (0-100ms) */
            const glideMs = Math.max(0.1, this.params.glide);
            const pitchCoeff = 1 - Math.exp(-1000 / (sampleRate * glideMs));

            for (let i = 0; i < bufferSize; i++) {
                /* Smooth pitch CV per-sample for glide effect */
                pitchState += pitchCoeff * (this.inputs.vOct - pitchState);
                pwmState += pwmCoeff * (targetDuty - pwmState);
                const smoothedVOct = pitchState;
                const smoothedDuty = pwmState;

                const freq = Math.max(0, base * 2 ** smoothedVOct * 2 ** (this.params.fine / 12) + this.inputs.fm * fmVoltsPerHz);
                const inc = freq / sampleRate;

                // Hard sync on rising edge
                if (lastSync <= 0 && this.inputs.sync > 0) phase = 0;
                lastSync = this.inputs.sync;
                phase = (phase + inc) % 1;
                const t = phase;

                /* Naive waveforms */
                let sawVal = 2 * t - 1;
                let sqrVal = t < smoothedDuty ? 1 : -1;

                /* Apply PolyBLEP correction at discontinuities */
                sawVal -= polyBlep(t, inc);
                sqrVal += polyBlep(t, inc);
                sqrVal -= polyBlep((t + 1 - smoothedDuty) % 1, inc);

                /* Triangle via integrated saw (naturally band-limited) */
                tri[i] = (4 * Math.abs(t - 0.5) - 1) * 5;
                saw[i] = sawVal * 5;
                sqr[i] = sqrVal * 5;
            }
        }
    };
}
