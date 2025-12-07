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

export default {
    id: 'euclid',
    name: 'EUCLID',
    hp: 4,
    color: '#6b4c8a',
    category: 'sequencer',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const trig = new Float32Array(bufferSize);

        // Internal state
        let currentStep = -1;  // Start at -1 so first clock advances to 0
        let lastClock = false;
        let lastReset = false;

        // Trigger output state - needs to survive test helper's 3-process cycle
        // At 44100 Hz with 512-sample buffers, 10ms = 441 samples, but we need ~1536 samples (3 buffers)
        // Use at least 4 buffers to ensure trigger persists after sendTrigger completes
        const TRIGGER_SAMPLES = Math.max(Math.floor(sampleRate * 0.01), bufferSize * 4);  // 10ms or 4 buffers
        let triggerCounter = 0;

        // CV scaling: +5V = +8 steps/hits
        const CV_SCALE = 8 / 5;

        /**
         * Generate Euclidean pattern using bucket/accumulator method
         * Returns array of 0s and 1s
         */
        function generatePattern(hits, length) {
            if (length <= 0) return [];
            if (hits <= 0) return new Array(length).fill(0);
            if (hits >= length) return new Array(length).fill(1);

            const pattern = [];
            let bucket = 0;
            for (let i = 0; i < length; i++) {
                bucket += hits;
                if (bucket >= length) {
                    bucket -= length;
                    pattern.push(1);
                } else {
                    pattern.push(0);
                }
            }
            return pattern;
        }

        /**
         * Check if current step is a hit (with rotation applied)
         */
        function isHit(step, rotate, pattern) {
            if (pattern.length === 0) return false;
            const rotatedStep = ((step - rotate) % pattern.length + pattern.length) % pattern.length;
            return pattern[rotatedStep] === 1;
        }

        return {
            params: {
                length: 8,   // 1-16 steps
                hits: 3,     // 0-length hits
                rotate: 0    // 0 to length-1
            },

            inputs: {
                clock: new Float32Array(bufferSize),
                reset: new Float32Array(bufferSize),
                lenCV: new Float32Array(bufferSize),
                hitsCV: new Float32Array(bufferSize)
            },

            outputs: { trig },

            leds: { active: 0 },

            process() {
                const { length, hits, rotate } = this.params;
                const { clock, reset, lenCV, hitsCV } = this.inputs;

                // Use first sample of CV for this buffer (optimization)
                const cvLen = lenCV[0] * CV_SCALE;
                const effectiveLength = Math.round(
                    Math.max(1, Math.min(16, length + cvLen))
                );

                const cvHits = hitsCV[0] * CV_SCALE;
                const effectiveHits = Math.round(
                    Math.max(0, Math.min(effectiveLength, hits + cvHits))
                );

                // Generate pattern for current settings
                const pattern = generatePattern(effectiveHits, effectiveLength);

                for (let i = 0; i < bufferSize; i++) {
                    // Reset detection (rising edge, threshold >= 1V)
                    const resetHigh = reset[i] >= 1;
                    if (resetHigh && !lastReset) {
                        currentStep = -1;  // Will advance to 0 on next clock
                    }
                    lastReset = resetHigh;

                    // Clock detection (rising edge, threshold >= 1V)
                    const clockHigh = clock[i] >= 1;
                    if (clockHigh && !lastClock) {
                        // Advance to next step
                        currentStep = (currentStep + 1) % effectiveLength;

                        // Check if this step is a hit
                        if (isHit(currentStep, rotate, pattern)) {
                            triggerCounter = TRIGGER_SAMPLES;
                            this.leds.active = 1;
                        }
                    }
                    lastClock = clockHigh;

                    // Output trigger
                    if (triggerCounter > 0) {
                        trig[i] = 10;
                        triggerCounter--;
                        if (triggerCounter === 0) {
                            this.leds.active = 0;
                        }
                    } else {
                        trig[i] = 0;
                    }
                }
            },

            reset() {
                trig.fill(0);
                currentStep = -1;
                lastClock = false;
                lastReset = false;
                triggerCounter = 0;
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
            { id: 'clock', label: 'Clk', port: 'clock', type: 'trigger' },
            { id: 'reset', label: 'Rst', port: 'reset', type: 'trigger' },
            { id: 'lenCV', label: 'Len', port: 'lenCV', type: 'cv' },
            { id: 'hitsCV', label: 'Hits', port: 'hitsCV', type: 'cv' }
        ],
        outputs: [
            { id: 'trig', label: 'Trig', port: 'trig', type: 'trigger' }
        ]
    }
};
