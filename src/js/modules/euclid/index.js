/**
 * Euclidean Rhythm Generator Module
 *
 * Based on: 2hp Euclid
 * Generates Euclidean rhythms - evenly distributed hits over a pattern length.
 *
 * Controls:
 * - Length: Pattern length (1-16 steps)
 * - Hits: Number of active steps (0 to Length)
 * - Rotate: Shifts pattern start point
 *
 * Inputs:
 * - Clock: Trigger to advance sequence
 * - Reset: Restart pattern from step 0
 * - LenCV: CV modulation of length (+5V = +8 steps)
 * - HitsCV: CV modulation of hits (+5V = +8 hits)
 *
 * Outputs:
 * - Trig: Trigger output (10V pulse on active steps)
 *
 * References:
 * - https://www.twohp.com/modules/euclid
 * - https://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf
 */

import { clamp } from '../../utils/math.js';

export default {
    id: 'euclid',
    name: 'EUCLID',
    hp: 4,
    color: 'module-color-eleven',
    category: 'sequencer',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const clock = new Float32Array(bufferSize);
        const reset = new Float32Array(bufferSize);
        const lenCV = new Float32Array(bufferSize);
        const hitsCV = new Float32Array(bufferSize);
        const trig = new Float32Array(bufferSize);

        // Internal state
        let currentStep = -1;  // Start at -1 so first clock advances to 0
        let lastClock = false;
        let lastReset = false;

        const TRIGGER_SAMPLES = Math.max(1, Math.round(sampleRate * 0.008));
        const LED_SAMPLES = Math.max(1, Math.round(sampleRate * 0.05));
        let triggerCounter = 0;
        let ledCounter = 0;

        // CV scaling: +5V = +8 steps/hits
        const CV_SCALE = 8 / 5;

        /**
         * Check if current step is a hit (with rotation applied)
         */
        function isHit(step, rotate, hits, length) {
            if (hits <= 0) return false;
            if (hits >= length) return true;
            const rotatedStep = ((step - rotate) % length + length) % length;
            return Math.floor(((rotatedStep + 1) * hits) / length) !==
                Math.floor((rotatedStep * hits) / length);
        }

        return {
            params: {
                length: 8,   // 1-16 steps
                hits: 3,     // 0-length hits
                rotate: 0    // 0 to length-1
            },

            inputs: {
                clock,
                reset,
                lenCV,
                hitsCV
            },

            outputs: { trig },

            leds: { active: 0 },

            process() {
                const { length, hits, rotate } = this.params;
                const baseLength = Number.isFinite(length) ? clamp(Math.round(length), 1, 16) : 8;
                const baseHits = Number.isFinite(hits) ? clamp(Math.round(hits), 0, 16) : 3;
                const safeRotate = Number.isFinite(rotate) ? Math.round(rotate) : 0;

                for (let i = 0; i < bufferSize; i++) {
                    const lengthCvSample = Number.isFinite(lenCV[i]) ? clamp(lenCV[i], -5, 5) : 0;
                    const hitsCvSample = Number.isFinite(hitsCV[i]) ? clamp(hitsCV[i], -5, 5) : 0;
                    const effectiveLength = clamp(
                        Math.round(baseLength + lengthCvSample * CV_SCALE),
                        1,
                        16
                    );
                    const effectiveHits = clamp(
                        Math.round(baseHits + hitsCvSample * CV_SCALE),
                        0,
                        effectiveLength
                    );

                    // Reset detection (rising edge, threshold >= 1V)
                    const resetHigh = Number.isFinite(reset[i]) && reset[i] >= 1;
                    if (resetHigh && !lastReset) {
                        currentStep = -1;  // Will advance to 0 on next clock
                        triggerCounter = 0;
                        ledCounter = 0;
                    }
                    lastReset = resetHigh;

                    // Clock detection (rising edge, threshold >= 1V)
                    const clockHigh = Number.isFinite(clock[i]) && clock[i] >= 1;
                    if (!resetHigh && clockHigh && !lastClock) {
                        // Advance to next step
                        currentStep = (currentStep + 1) % effectiveLength;

                        // Check if this step is a hit
                        if (isHit(currentStep, safeRotate, effectiveHits, effectiveLength)) {
                            triggerCounter = TRIGGER_SAMPLES;
                            ledCounter = LED_SAMPLES;
                        }
                    }
                    lastClock = clockHigh;

                    // Output trigger
                    if (triggerCounter > 0) {
                        trig[i] = 10;
                        triggerCounter--;
                    } else {
                        trig[i] = 0;
                    }
                    if (ledCounter > 0) ledCounter--;
                }
                this.leds.active = ledCounter > 0 ? 1 : 0;
            },

            reset() {
                clock.fill(0);
                reset.fill(0);
                lenCV.fill(0);
                hitsCV.fill(0);
                trig.fill(0);
                currentStep = -1;
                lastClock = false;
                lastReset = false;
                triggerCounter = 0;
                ledCounter = 0;
                this.leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'length', label: 'Length', param: 'length', min: 1, max: 16, default: 8, step: 1 },
            { id: 'hits', label: 'Hits', param: 'hits', min: 0, max: 16, default: 3, step: 1 },
            { id: 'rotate', label: 'Rotate', param: 'rotate', min: 0, max: 15, default: 0, step: 1 }
        ],
        inputs: [
            { id: 'clock', label: 'Clk', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'reset', label: 'Rst', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'lenCV', label: 'Len', port: 'lenCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'hitsCV', label: 'Hits', port: 'hitsCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'trig', label: 'Trig', port: 'trig', signal: 'trigger', voltage: { min: 0, max: 10 } }
        ]
    }
};
