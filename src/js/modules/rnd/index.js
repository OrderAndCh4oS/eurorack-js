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
    color: 'module-color-twelve',
    category: 'modulation',

    createDSP({ sampleRate = 44100, bufferSize = 512, random = Math.random } = {}) {
        const clock = new Float32Array(bufferSize);
        const step = new Float32Array(bufferSize);
        const smooth = new Float32Array(bufferSize);
        const gate = new Float32Array(bufferSize);
        const rng = typeof random === 'function' ? random : Math.random;

        // Internal state
        let currentUnitValue = 0;  // Held random value before Amp scaling
        let smoothValue = 0;       // Current smoothed value
        let phase = 0;             // Clock phase (0-1)
        let lastClockHigh = false; // For external clock edge detection
        let clockConnected = false;
        let gateCounter = 0;       // Gate pulse duration counter
        let ledCounter = 0;

        // Gate pulse duration in samples (~10ms)
        const GATE_SAMPLES = Math.max(1, Math.round(sampleRate * 0.01));
        const LED_SAMPLES = Math.max(1, Math.round(sampleRate * 0.05));

        function nextRandom() {
            const value = rng();
            return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
        }

        return {
            params: {
                rate: 0.5,  // 0-1, clock speed
                amp: 1      // 0-1, output amplitude
            },

            inputs: {
                clock
            },

            outputs: { step, smooth, gate },

            leds: { active: 0 },

            process() {
                const rate = Number.isFinite(this.params.rate)
                    ? Math.min(1, Math.max(0, this.params.rate))
                    : 0.5;
                const amp = Number.isFinite(this.params.amp)
                    ? Math.min(1, Math.max(0, this.params.amp))
                    : 1;

                // Calculate clock frequency from rate (0.1Hz to 20Hz)
                const minFreq = 0.1;
                const maxFreq = 20;
                const freq = minFreq * Math.pow(maxFreq / minFreq, rate);
                const phaseInc = freq / sampleRate;

                // Physical-time one-pole slew: 250ms at Rate minimum to 5ms
                // at maximum, invariant across sample rates.
                const slewSeconds = 0.25 * Math.pow(0.02, rate);
                const slewRate = 1 - Math.exp(-1 / (slewSeconds * sampleRate));

                for (let i = 0; i < bufferSize; i++) {
                    let triggered = false;
                    let emitGate = false;

                    // Check for external clock
                    const extClock = Number.isFinite(clock[i]) ? clock[i] : 0;
                    const clockHigh = extClock >= 1;
                    if (clockHigh && !lastClockHigh) {
                        triggered = true;
                        emitGate = clockConnected
                            ? rate >= 1 || (rate > 0 && nextRandom() < rate)
                            : true;
                    }
                    lastClockHigh = clockHigh;

                    // A connected external cable owns timing even while low.
                    if (!clockConnected) {
                        phase += phaseInc;
                        if (phase >= 1) {
                            phase -= Math.floor(phase);
                            triggered = true;
                            emitGate = true;
                        }
                    }

                    // Generate new random value on trigger
                    if (triggered) {
                        currentUnitValue = nextRandom();
                        if (emitGate) gateCounter = GATE_SAMPLES;
                        ledCounter = LED_SAMPLES;
                    }

                    const currentValue = currentUnitValue * 10 * amp;
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
                    } else {
                        gate[i] = 0;
                    }
                    if (ledCounter > 0) ledCounter--;
                }

                this.leds.active = ledCounter > 0 ? 1 : 0;
            },

            reset() {
                clock.fill(0);
                step.fill(0);
                smooth.fill(0);
                gate.fill(0);
                currentUnitValue = 0;
                smoothValue = 0;
                phase = 0;
                lastClockHigh = false;
                gateCounter = 0;
                ledCounter = 0;
                this.leds.active = 0;
            },

            onInputConnected(port) {
                if (port !== 'clock') return;
                clockConnected = true;
                lastClockHigh = false;
            },

            onInputDisconnected(port) {
                if (port !== 'clock') return;
                clockConnected = false;
                lastClockHigh = false;
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
            { id: 'clock', label: 'Clk', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'step', label: 'Step', port: 'step', signal: 'cv', voltage: { min: 0, max: 10 } },
            { id: 'smooth', label: 'Smth', port: 'smooth', signal: 'cv', voltage: { min: 0, max: 10 } },
            { id: 'gate', label: 'Gate', port: 'gate', signal: 'gate', voltage: { min: 0, max: 10 } }
        ]
    }
};
