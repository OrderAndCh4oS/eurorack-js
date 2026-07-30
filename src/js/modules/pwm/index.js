/**
 * PWM - Pulse Width Modulation Generator
 *
 * Based on Doepfer A-168-1
 * https://doepfer.de/a1681.htm
 *
 * Converts any continuously varying signal (triangle, saw, sine, envelope)
 * into a pulse/rectangle wave with adjustable and CV-controllable pulse width.
 *
 * Features:
 * - Manual pulse width control (0-100%)
 * - PWM CV input with attenuator
 * - Normal and inverted outputs
 * - LED indicators for output states
 */

export default {
    id: 'pwm',
    name: 'PWM',
    hp: 4,
    color: 'module-color-nine',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const ownIn = new Float32Array(bufferSize);
        const ownPwmCV = new Float32Array(bufferSize);

        // LED smoothing
        let ledOutSmooth = 0;
        let ledInvSmooth = 0;
        const ledSmoothCoeff = Math.exp(-bufferSize / (sampleRate * 0.1));
        let previousDifference = 0;
        let previousHigh = false;

        return {
            params: {
                pw: 0.5,      // Pulse width 0-1 (0.5 = 50% duty cycle)
                pwmAmt: 0.5   // PWM CV attenuator amount
            },

            inputs: {
                in: ownIn,
                pwmCV: ownPwmCV
            },

            outputs: {
                out: new Float32Array(bufferSize),
                inv: new Float32Array(bufferSize)
            },

            leds: {
                out: 0,
                inv: 0
            },

            process() {
                const { in: input, pwmCV } = this.inputs;
                const pw = Math.max(0, Math.min(1, Number.isFinite(this.params.pw) ? this.params.pw : 0.5));
                const pwmAmt = Math.max(0, Math.min(1, Number.isFinite(this.params.pwmAmt) ? this.params.pwmAmt : 0.5));
                const { out, inv } = this.outputs;

                // Convert PW knob (0-1) to threshold voltage
                // At 0.5 (center), threshold = 0V for symmetric 50% duty cycle
                // Range covers ±5V to match typical input signal range
                const baseThreshold = (pw - 0.5) * 10;

                let highAmount = 0;
                let invHighAmount = 0;

                for (let i = 0; i < bufferSize; i++) {
                    // Modulated threshold: base + CV * amount
                    // CV is scaled so ±5V CV with full amount gives full range
                    const cv = Number.isFinite(pwmCV[i]) ? pwmCV[i] : 0;
                    const sample = Number.isFinite(input[i]) ? input[i] : 0;
                    const threshold = baseThreshold - cv * pwmAmt;
                    const difference = sample - threshold;
                    const high = difference > 0;

                    let output = high ? 5 : -5;
                    if (high !== previousHigh) {
                        const denominator = Math.abs(previousDifference) + Math.abs(difference);
                        const crossing = denominator > 1e-12
                            ? Math.abs(previousDifference) / denominator
                            : 0.5;
                        const previousLevel = previousHigh ? 5 : -5;
                        const nextLevel = high ? 5 : -5;
                        output = previousLevel * crossing + nextLevel * (1 - crossing);
                    }
                    previousDifference = difference;
                    previousHigh = high;

                    out[i] = output;
                    inv[i] = -output;
                    highAmount += output / 10 + 0.5;
                    invHighAmount += -output / 10 + 0.5;
                }

                // LED brightness based on duty cycle, smoothed to avoid flicker
                const rawOut = highAmount / bufferSize;
                const rawInv = invHighAmount / bufferSize;
                ledOutSmooth = ledOutSmooth * ledSmoothCoeff + rawOut * (1 - ledSmoothCoeff);
                ledInvSmooth = ledInvSmooth * ledSmoothCoeff + rawInv * (1 - ledSmoothCoeff);
                this.leds.out = ledOutSmooth;
                this.leds.inv = ledInvSmooth;

                // Reset inputs if replaced by routing
            },

            reset() {
                ledOutSmooth = 0;
                ledInvSmooth = 0;
                previousDifference = 0;
                previousHigh = false;
                ownIn.fill(0);
                ownPwmCV.fill(0);
                this.outputs.out.fill(0);
                this.outputs.inv.fill(0);
                this.leds.out = 0;
                this.leds.inv = 0;
            }
        };
    },

    ui: {
        leds: ['out', 'inv'],
        knobs: [
            { id: 'pw', label: 'PW', param: 'pw', min: 0, max: 1, default: 0.5 },
            { id: 'pwmAmt', label: 'PWM', param: 'pwmAmt', min: 0, max: 1, default: 0.5 }
        ],
        switches: [],
        inputs: [
            { id: 'in', label: 'In', port: 'in', signal: 'audio' },
            { id: 'pwmCV', label: 'PWM', port: 'pwmCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', signal: 'audio' },
            { id: 'inv', label: 'Inv', port: 'inv', signal: 'audio' }
        ]
    }
};
