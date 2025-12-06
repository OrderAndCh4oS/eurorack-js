/**
 * CLK - Voltage Controlled Clock Generator
 *
 * Based on the 2hp Clk module specifications:
 * - Wide frequency range: 0.1 Hz to 10 kHz (exponential)
 * - Rate CV input: 0V to 10V modulates frequency
 * - Pause input: Gate >2V pauses clock
 * - Pause button: Toggle to pause
 * - Output: 10V pulses
 * - LED: Indicates clock rate
 */

import { clamp } from '../../utils/math.js';

export default {
    id: 'clk',
    name: 'CLK',
    hp: 2,
    color: '#6a5a2a',
    category: 'utility',

    /**
     * Create DSP instance
     * @param {Object} options
     * @param {number} options.sampleRate - Sample rate in Hz
     * @param {number} options.bufferSize - Buffer size in samples
     * @returns {Object} DSP instance
     */
    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const clockOut = new Float32Array(bufferSize);

        // Clock state
        let phase = 0;

        // Pulse width (max 10ms for low frequency clocks)
        const maxPulseWidth = Math.floor(0.01 * sampleRate);
        let pulseSamples = 0;

        /**
         * Map rate knob (0-1) to frequency (0.1Hz - 10kHz) exponentially
         * 5 decades: 0.1, 1, 10, 100, 1000, 10000 Hz
         */
        function rateToFrequency(rate) {
            return 0.1 * Math.pow(100000, clamp(rate, 0, 1));
        }

        return {
            params: {
                rate: 0.3,
                pause: 0
            },

            inputs: {
                rateCV: new Float32Array(bufferSize),
                pause: new Float32Array(bufferSize)
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
                        phase += phaseInc;

                        // Check for clock tick (phase wrap)
                        if (phase >= 1) {
                            phase -= Math.floor(phase);
                            // Dynamic pulse width: 25% of period
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

            reset() {
                phase = 0;
                pulseSamples = 0;
            }
        };
    },

    // Declarative UI definition
    ui: {
        leds: ['clock'],
        knobs: [
            { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: 0.3 }
        ],
        switches: [
            { id: 'pause', label: 'Pause', param: 'pause', default: 0 }
        ],
        outputs: [
            { id: 'clock', label: 'Out', port: 'clock', type: 'trigger' }
        ],
        inputs: [
            { id: 'rateCV', label: 'Rate', port: 'rateCV', type: 'cv' },
            { id: 'pauseIn', label: 'Pause', port: 'pause', type: 'trigger' }
        ]
    }
};
