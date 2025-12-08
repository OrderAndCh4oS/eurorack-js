/**
 * Rnd (Random) Module
 *
 * Based on: 2hp Rnd
 * Random voltage generator with stepped and smooth outputs,
 * internal clock, and gate output.
 *
 * Controls:
 * - Rate: Internal clock speed
 * - Amp: Output amplitude (0-10V range)
 *
 * Inputs:
 * - Clock: External clock input (overrides internal clock)
 *
 * Outputs:
 * - Step: Stepped random voltage (sample & hold)
 * - Smooth: Slewed random voltage (smoothly varying)
 * - Gate: Clock output (internal) or random gates (external)
 *
 * References:
 * - https://www.twohp.com/modules/p/rnd
 * - https://pugix.com/synth/2hp-rnd-module/
 */

export default {
    id: 'rnd',
    name: 'RND',
    hp: 4,
    color: '#4a5568',
    category: 'modulator',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const step = new Float32Array(bufferSize);
        const smooth = new Float32Array(bufferSize);
        const gate = new Float32Array(bufferSize);

        // Internal state
        let currentValue = 0;      // Current stepped random value
        let smoothValue = 0;       // Current smoothed value
        let phase = 0;             // Clock phase (0-1)
        let lastClock = 0;         // For external clock edge detection
        let gateCounter = 0;       // Gate pulse duration counter

        // Gate pulse duration in samples (~10ms)
        const GATE_SAMPLES = Math.floor(sampleRate * 0.01);

        return {
            params: {
                rate: 0.5,  // 0-1, clock speed
                amp: 1      // 0-1, output amplitude
            },

            inputs: {
                clock: new Float32Array(bufferSize)
            },

            outputs: { step, smooth, gate },

            leds: { active: 0 },

            process() {
                const { rate, amp } = this.params;
                const { clock } = this.inputs;

                // Calculate clock frequency from rate (0.1Hz to 20Hz)
                const minFreq = 0.1;
                const maxFreq = 20;
                const freq = minFreq * Math.pow(maxFreq / minFreq, rate);
                const phaseInc = freq / sampleRate;

                // Slew rate for smooth output (inverse of rate for slower = smoother)
                const slewRate = 0.0001 + rate * 0.01;

                for (let i = 0; i < bufferSize; i++) {
                    let triggered = false;

                    // Check for external clock
                    const extClock = clock[i];
                    if (extClock >= 1 && lastClock < 1) {
                        // External clock rising edge
                        triggered = true;
                    }
                    lastClock = extClock;

                    // Internal clock (only if no external clock activity)
                    if (extClock < 0.5) {
                        phase += phaseInc;
                        if (phase >= 1) {
                            phase -= 1;
                            triggered = true;
                        }
                    }

                    // Generate new random value on trigger
                    if (triggered) {
                        currentValue = Math.random() * 10 * amp;
                        gateCounter = GATE_SAMPLES;
                        this.leds.active = 1;
                    }

                    // Slew towards current value for smooth output
                    smoothValue += (currentValue - smoothValue) * slewRate;

                    // Output stepped value
                    step[i] = currentValue;

                    // Output smooth value
                    smooth[i] = smoothValue;

                    // Output gate
                    if (gateCounter > 0) {
                        gate[i] = 10;
                        gateCounter--;
                        if (gateCounter === 0) {
                            this.leds.active = 0;
                        }
                    } else {
                        gate[i] = 0;
                    }
                }
            },

            reset() {
                step.fill(0);
                smooth.fill(0);
                gate.fill(0);
                currentValue = 0;
                smoothValue = 0;
                phase = 0;
                lastClock = 0;
                gateCounter = 0;
                this.leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: 0.5 },
            { id: 'amp', label: 'Amp', param: 'amp', min: 0, max: 1, default: 1 }
        ],
        inputs: [
            { id: 'clock', label: 'Clk', port: 'clock', type: 'trigger' }
        ],
        outputs: [
            { id: 'step', label: 'Step', port: 'step', type: 'cv' },
            { id: 'smooth', label: 'Smth', port: 'smooth', type: 'cv' },
            { id: 'gate', label: 'Gate', port: 'gate', type: 'gate' }
        ]
    }
};
