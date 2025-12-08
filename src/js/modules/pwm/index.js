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
    color: '#4a2c6a',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const ownIn = new Float32Array(bufferSize);
        const ownPwmCV = new Float32Array(bufferSize);

        // LED smoothing
        let ledOutSmooth = 0;
        let ledInvSmooth = 0;
        const ledSmoothCoeff = 0.9;

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
                const { pw, pwmAmt } = this.params;
                const { out, inv } = this.outputs;

                // Convert PW knob (0-1) to threshold voltage
                // At 0.5 (center), threshold = 0V for symmetric 50% duty cycle
                // Range covers ±5V to match typical input signal range
                const baseThreshold = (pw - 0.5) * 10;

                let highCount = 0;
                let invHighCount = 0;

                for (let i = 0; i < bufferSize; i++) {
                    // Modulated threshold: base + CV * amount
                    // CV is scaled so ±5V CV with full amount gives full range
                    const threshold = baseThreshold - pwmCV[i] * pwmAmt * 2;

                    // Comparator: output high when input > threshold
                    if (input[i] > threshold) {
                        out[i] = 5;
                        inv[i] = -5;
                        highCount++;
                    } else {
                        out[i] = -5;
                        inv[i] = 5;
                        invHighCount++;
                    }
                }

                // LED brightness based on duty cycle, smoothed to avoid flicker
                const rawOut = highCount / bufferSize;
                const rawInv = invHighCount / bufferSize;
                ledOutSmooth = ledOutSmooth * ledSmoothCoeff + rawOut * (1 - ledSmoothCoeff);
                ledInvSmooth = ledInvSmooth * ledSmoothCoeff + rawInv * (1 - ledSmoothCoeff);
                this.leds.out = ledOutSmooth;
                this.leds.inv = ledInvSmooth;

                // Reset inputs if replaced by routing
                if (this.inputs.in !== ownIn) {
                    ownIn.fill(0);
                    this.inputs.in = ownIn;
                }
                if (this.inputs.pwmCV !== ownPwmCV) {
                    ownPwmCV.fill(0);
                    this.inputs.pwmCV = ownPwmCV;
                }
            },

            reset() {
                ledOutSmooth = 0;
                ledInvSmooth = 0;
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
            { id: 'in', label: 'In', port: 'in', type: 'audio' },
            { id: 'pwmCV', label: 'PWM', port: 'pwmCV', type: 'cv' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'audio' },
            { id: 'inv', label: 'Inv', port: 'inv', type: 'audio' }
        ]
    }
};
