import { clamp } from '../utils/math.js';

/**
 * Clock / Divider Module
 *
 * Master clock with multiple divided outputs
 * Based on classic clock/divider designs like 4MS RCD
 *
 * Params:
 *   bpm: 0-1 (30 to 300 BPM, exponential)
 *   swing: 0-1 (0% to 75% swing on /2 output)
 *
 * Inputs:
 *   extClock: 0-5V (external clock input)
 *   reset: 0-5V (reset all dividers)
 *
 * Outputs:
 *   clock: 0/5V (main clock pulse)
 *   div2: 0/5V (/2 with swing)
 *   div4: 0/5V (/4)
 *   div8: 0/5V (/8)
 *
 * @param {Object} options
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @returns {Object} Clock/Divider module
 */
export function createClockDiv({ sampleRate = 44100, bufferSize = 512 } = {}) {
    const clock = new Float32Array(bufferSize);
    const div2 = new Float32Array(bufferSize);
    const div4 = new Float32Array(bufferSize);
    const div8 = new Float32Array(bufferSize);

    /* Clock state */
    let phase = 0;
    let counter = 0;           /* Counts clock pulses for divisions */
    let lastExtClock = 0;
    let lastReset = 0;

    /* Pulse width (10ms typical for triggers) */
    const pulseWidth = 0.01 * sampleRate;
    let pulseSamples = [0, 0, 0, 0]; /* Remaining samples for each output pulse */

    /* Swing timing state */
    let swingPhase = false;    /* Toggle for swing timing */

    return {
        params: { bpm: 0.4, swing: 0 },
        inputs: { extClock: 0, reset: 0 },
        outputs: { clock, div2, div4, div8 },
        leds: { clock: 0 },
        process() {
            /* BPM from knob (30 to 300 BPM) */
            const bpm = 30 * Math.pow(10, clamp(this.params.bpm));
            const clockHz = bpm / 60;
            const clockInc = clockHz / sampleRate;

            /* Swing amount (0 to 75%) */
            const swingAmount = clamp(this.params.swing) * 0.75;

            for (let i = 0; i < bufferSize; i++) {
                /* Check for reset */
                const resetEdge = this.inputs.reset >= 1 && lastReset < 1;
                lastReset = this.inputs.reset;
                if (resetEdge) {
                    phase = 0;
                    counter = 0;
                    swingPhase = false;
                    pulseSamples = [0, 0, 0, 0];
                }

                /* Check for external clock override */
                const extEdge = this.inputs.extClock >= 1 && lastExtClock < 1;
                lastExtClock = this.inputs.extClock;

                /* Internal clock tick detection */
                const prevPhase = phase;
                phase += clockInc;
                const internalTick = prevPhase < 1 && phase >= 1;
                if (phase >= 1) phase -= 1;

                /* Clock tick (internal or external) */
                const tick = extEdge || (this.inputs.extClock < 0.5 && internalTick);

                if (tick) {
                    /* Main clock pulse */
                    pulseSamples[0] = pulseWidth;
                    counter++;

                    /* /2 with swing */
                    if (counter % 2 === 0) {
                        swingPhase = !swingPhase;
                        /* Swing delays alternate beats */
                        if (!swingPhase || swingAmount < 0.01) {
                            pulseSamples[1] = pulseWidth;
                        }
                    } else if (swingPhase && swingAmount >= 0.01) {
                        /* Delayed swing beat - check if we should trigger now */
                        /* (This is a simplified swing - ideally would be timing-based) */
                        pulseSamples[1] = pulseWidth;
                    }

                    /* /4 */
                    if (counter % 4 === 0) {
                        pulseSamples[2] = pulseWidth;
                    }

                    /* /8 */
                    if (counter % 8 === 0) {
                        pulseSamples[3] = pulseWidth;
                    }
                }

                /* Output pulses (decay) */
                clock[i] = pulseSamples[0] > 0 ? 5 : 0;
                div2[i] = pulseSamples[1] > 0 ? 5 : 0;
                div4[i] = pulseSamples[2] > 0 ? 5 : 0;
                div8[i] = pulseSamples[3] > 0 ? 5 : 0;

                /* Decrement pulse counters */
                for (let p = 0; p < 4; p++) {
                    if (pulseSamples[p] > 0) pulseSamples[p]--;
                }
            }

            /* LED blinks with clock */
            this.leds.clock = pulseSamples[0] > 0 ? 1 : 0;
        }
    };
}
