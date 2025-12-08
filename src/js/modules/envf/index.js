/**
 * ENVF (Envelope Follower) Module
 *
 * Based on: Plankton Electronics ENVF
 * Tracks audio amplitude and outputs control voltage.
 *
 * Controls:
 * - Threshold: Minimum level for envelope to respond
 * - Gain: Output amplitude scaling
 * - Slope: Fast/Slow response (switch)
 *
 * Inputs:
 * - Audio: Audio signal to follow
 *
 * Outputs:
 * - Env: Envelope CV (0-10V)
 * - Inv: Inverted envelope (10V - env)
 *
 * References:
 * - https://planktonelectronics.com/store/envf/
 * - https://www.musicdsp.org/en/latest/Analysis/136-envelope-follower-with-different-attack-and-release.html
 */

export default {
    id: 'envf',
    name: 'ENVF',
    hp: 4,
    color: '#6b5b95',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const env = new Float32Array(bufferSize);
        const inv = new Float32Array(bufferSize);

        // Internal state
        let envelope = 0;

        // Coefficient calculation helper
        // Time for envelope to go from 100% to 1%
        function calcCoef(timeMs) {
            return Math.pow(0.01, 1.0 / (timeMs * sampleRate * 0.001));
        }

        // Timing constants for slope modes
        const FAST_ATTACK_MS = 1;
        const FAST_RELEASE_MS = 10;
        const SLOW_ATTACK_MS = 10;
        const SLOW_RELEASE_MS = 100;

        return {
            params: {
                threshold: 0.1,  // 0-1, maps to 0-5V threshold
                gain: 0.5,       // 0-1, output scaling
                slope: 0         // 0 = fast, 1 = slow
            },

            inputs: {
                audio: new Float32Array(bufferSize)
            },

            outputs: { env, inv },

            leds: { active: 0 },

            process() {
                const { threshold, gain, slope } = this.params;
                const { audio } = this.inputs;

                // Calculate threshold voltage (0-5V range)
                const thresholdV = threshold * 5;

                // Get timing based on slope
                const attackMs = slope < 0.5 ? FAST_ATTACK_MS : SLOW_ATTACK_MS;
                const releaseMs = slope < 0.5 ? FAST_RELEASE_MS : SLOW_RELEASE_MS;

                const attackCoef = calcCoef(attackMs);
                const releaseCoef = calcCoef(releaseMs);

                // Track if signal exceeded threshold this buffer
                let thresholdExceeded = false;

                for (let i = 0; i < bufferSize; i++) {
                    // Rectify input
                    const rectified = Math.abs(audio[i]);

                    // Check threshold
                    if (rectified >= thresholdV) {
                        thresholdExceeded = true;

                        // Apply envelope follower algorithm
                        if (rectified > envelope) {
                            // Attack - signal rising
                            envelope = attackCoef * (envelope - rectified) + rectified;
                        } else {
                            // Release - signal falling
                            envelope = releaseCoef * (envelope - rectified) + rectified;
                        }
                    } else {
                        // Below threshold - decay towards zero
                        envelope = releaseCoef * envelope;
                    }

                    // Scale envelope to 0-10V range with gain
                    // Input audio is ±5V, so max rectified is 5V
                    // Scale to 0-10V output (standard CV range)
                    const scaledEnv = Math.min(10, envelope * 2 * gain);

                    env[i] = scaledEnv;
                    inv[i] = 10 - scaledEnv;
                }

                // LED shows when signal crosses threshold
                this.leds.active = thresholdExceeded ? 1 : 0;
            },

            reset() {
                env.fill(0);
                inv.fill(10);
                envelope = 0;
                this.leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'threshold', label: 'Thresh', param: 'threshold', min: 0, max: 1, default: 0.1 },
            { id: 'gain', label: 'Gain', param: 'gain', min: 0, max: 1, default: 0.5 }
        ],
        switches: [
            { id: 'slope', label: 'Slope', param: 'slope', positions: ['Fast', 'Slow'], default: 0 }
        ],
        inputs: [
            { id: 'audio', label: 'In', port: 'audio', type: 'audio' }
        ],
        outputs: [
            { id: 'env', label: 'Env', port: 'env', type: 'cv' },
            { id: 'inv', label: 'Inv', port: 'inv', type: 'cv' }
        ]
    }
};
