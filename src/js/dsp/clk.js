import { clamp } from '../utils/math.js';

/**
 * 2HP Clk – Voltage Controlled Clock Generator
 *
 * Based on the 2hp Clk module specifications:
 * - Wide frequency range: 0.1 Hz to 10 kHz (exponential)
 * - Rate CV input: 0V to 10V modulates frequency
 * - Pause input: Gate >2V pauses clock
 * - Pause button: Toggle to pause
 * - Output: 10V pulses
 * - LED: Indicates clock rate
 *
 * Params:
 *   rate: 0-1 (maps to 0.1Hz - 10kHz exponential)
 *   pause: 0/1 (button toggle state)
 *
 * Inputs:
 *   rateCV: 0-10V CV buffer for rate modulation
 *   pause: Gate buffer (>2V triggers pause)
 *
 * Outputs:
 *   clock: 10V pulse output buffer
 *
 * @param {Object} options
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @returns {Object} Clk module
 */
export function createClk({ bufferSize = 512, sampleRate = 44100 } = {}) {
    const clockOut = new Float32Array(bufferSize);

    // Clock state
    let phase = 0;

    // Pulse width (max 10ms for low frequency clocks)
    const maxPulseWidth = Math.floor(0.01 * sampleRate);  // 10ms maximum
    let pulseSamples = 0;

    /**
     * Map rate knob (0-1) to frequency (0.1Hz - 10kHz) exponentially
     * 5 decades: 0.1, 1, 10, 100, 1000, 10000 Hz
     */
    function rateToFrequency(rate) {
        // 0 -> 0.1Hz, 1 -> 10000Hz (5 decades)
        return 0.1 * Math.pow(100000, clamp(rate, 0, 1));
    }

    return {
        params: {
            rate: 0.3,      // Rate knob (0-1)
            pause: 0        // Pause button state (0 or 1)
        },

        inputs: {
            rateCV: new Float32Array(bufferSize),   // Rate CV (0-10V)
            pause: new Float32Array(bufferSize)     // Pause gate (>2V)
        },

        outputs: {
            clock: clockOut
        },

        leds: {
            clock: 0
        },

        process() {
            const baseRate = this.params.rate;
            const pauseButton = this.params.pause;
            const rateCVIn = this.inputs.rateCV;
            const pauseIn = this.inputs.pause;

            for (let i = 0; i < bufferSize; i++) {
                // Check pause state (button OR gate >2V)
                const isPaused = pauseButton === 1 || pauseIn[i] > 2;

                if (!isPaused) {
                    // Apply CV modulation (0-10V maps to 0-1 additional rate)
                    const cvMod = clamp(rateCVIn[i], 0, 10) / 10;
                    const effectiveRate = clamp(baseRate + cvMod, 0, 1);

                    // Calculate frequency and phase increment
                    const freq = rateToFrequency(effectiveRate);
                    const phaseInc = freq / sampleRate;

                    // Advance phase
                    const prevPhase = phase;
                    phase += phaseInc;

                    // Check for clock tick (phase wrap)
                    if (phase >= 1) {
                        phase -= Math.floor(phase);
                        // Dynamic pulse width: 25% of period
                        // For high freq (audio rate), use minimum of 1 sample
                        // For low freq, cap at 10ms
                        const period = sampleRate / freq;
                        const dynamicPulse = Math.max(1, Math.floor(period * 0.25));
                        pulseSamples = Math.min(maxPulseWidth, dynamicPulse);
                    }
                }

                // Output pulse
                clockOut[i] = pulseSamples > 0 ? 10 : 0;
                if (pulseSamples > 0) pulseSamples--;
            }

            // LED follows clock output
            this.leds.clock = pulseSamples > 0 ? 1 : 0;
        },

        /**
         * Reset clock phase to beginning
         */
        reset() {
            phase = 0;
            pulseSamples = 0;
        }
    };
}
