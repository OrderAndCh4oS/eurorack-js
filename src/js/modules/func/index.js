/**
 * FUNC (Function Generator) Module
 *
 * Based on: Make Noise Function / MATHS
 * Generates envelopes, LFOs, slew limiting, and complex CV functions.
 *
 * Controls:
 * - Rise: Attack/rise time (0.5ms to 10s)
 * - Fall: Decay/fall time (0.5ms to 10s)
 * - Curve: Response shape (log → linear → exp)
 * - Cycle: Enable self-cycling (LFO mode)
 *
 * Inputs:
 * - In: Signal input for slew limiting
 * - Trig: Trigger input to start envelope
 * - RiseCV: Rise time CV modulation
 * - FallCV: Fall time CV modulation
 * - CycleCV: Gate to enable cycling
 *
 * Outputs:
 * - Out: Function output (0-10V)
 * - Inv: Inverted output (10V - out)
 * - EOR: End of Rise gate
 * - EOC: End of Cycle gate
 *
 * References:
 * - https://www.makenoisemusic.com/modules/maths/
 * - https://modulargrid.net/e/make-noise-maths--
 */

export default {
    id: 'func',
    name: 'FUNC',
    hp: 8,
    color: '#4a6741',
    category: 'modulator',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const inv = new Float32Array(bufferSize);
        const eor = new Float32Array(bufferSize);
        const eoc = new Float32Array(bufferSize);

        // Internal state
        let output = 0;
        let phase = 0;           // 0 = idle, 0-0.5 = rising, 0.5-1 = falling
        let rising = false;
        let falling = false;
        let lastTrig = 0;
        let lastIn = 0;
        let hasInput = false;    // Track if signal input is being used
        let eorPulseCount = 0;   // For gate pulse timing
        let eocPulseCount = 0;

        // Timing constants
        const MIN_TIME_MS = 0.5;
        const MAX_TIME_MS = 10000; // 10 seconds
        const GATE_PULSE_SAMPLES = Math.floor(sampleRate * 0.005); // 5ms pulse

        // Convert knob (0-1) to time in seconds
        function knobToTime(knob) {
            // Exponential mapping: 0.5ms to 10s
            const minLog = Math.log(MIN_TIME_MS);
            const maxLog = Math.log(MAX_TIME_MS);
            const timeMs = Math.exp(minLog + knob * (maxLog - minLog));
            return timeMs / 1000;
        }

        // Apply CV modulation to time (exponential, +/-5V = +/-2 octaves)
        function modulateTime(baseTime, cv) {
            const octaves = cv / 2.5; // +/-5V = +/-2 octaves
            return baseTime * Math.pow(2, octaves);
        }

        // Apply curve shaping to linear 0-1 value
        function applyCurve(t, curve) {
            // curve: 0 = logarithmic, 0.5 = linear, 1 = exponential
            if (t <= 0) return 0;
            if (t >= 1) return 1;

            if (curve < 0.5) {
                // Logarithmic (slow start, fast finish)
                const logAmount = (0.5 - curve) * 2; // 0-1
                const power = 0.3 + (1 - logAmount) * 0.7; // 0.3 to 1
                const logT = Math.pow(t, power);
                return t * (1 - logAmount) + logT * logAmount;
            } else if (curve > 0.5) {
                // Exponential (fast start, slow finish)
                const expAmount = (curve - 0.5) * 2; // 0-1
                const power = 1 + expAmount * 3; // 1 to 4
                const expT = Math.pow(t, power);
                return t * (1 - expAmount) + expT * expAmount;
            }
            // Linear
            return t;
        }

        return {
            params: {
                rise: 0.3,      // 0-1, maps to 0.5ms-10s
                fall: 0.3,      // 0-1, maps to 0.5ms-10s
                curve: 0.5,     // 0-1: log → linear → exp
                cycle: 0        // 0 = off, 1 = on
            },

            inputs: {
                in: new Float32Array(bufferSize),
                trig: new Float32Array(bufferSize),
                riseCV: new Float32Array(bufferSize),
                fallCV: new Float32Array(bufferSize),
                cycleCV: new Float32Array(bufferSize)
            },

            outputs: { out, inv, eor, eoc },

            leds: { level: 0 },

            process() {
                const { rise, fall, curve, cycle } = this.params;
                const { in: sigIn, trig, riseCV, fallCV, cycleCV } = this.inputs;

                // Base times from knobs
                const baseRiseTime = knobToTime(rise);
                const baseFallTime = knobToTime(fall);

                for (let i = 0; i < bufferSize; i++) {
                    // Get modulated times
                    const riseTime = modulateTime(baseRiseTime, riseCV[i]);
                    const fallTime = modulateTime(baseFallTime, fallCV[i]);

                    // Check if cycling is enabled (panel switch OR CV gate)
                    const cycling = cycle > 0.5 || cycleCV[i] > 2.5;

                    // Trigger detection (rising edge above 1V)
                    const trigHigh = trig[i] >= 1;
                    const trigEdge = trigHigh && lastTrig < 1;
                    lastTrig = trig[i];

                    // Check if signal input has meaningful content (for slew mode)
                    // Use higher threshold to avoid triggering on noise/residual values
                    const inputActive = Math.abs(sigIn[i]) > 0.1;
                    hasInput = inputActive;

                    // Handle EOR/EOC pulse decay
                    if (eorPulseCount > 0) {
                        eorPulseCount--;
                        eor[i] = 10;
                    } else {
                        eor[i] = 0;
                    }

                    if (eocPulseCount > 0) {
                        eocPulseCount--;
                        eoc[i] = 10;
                    } else {
                        eoc[i] = 0;
                    }

                    if (hasInput && !trigEdge) {
                        // SLEW LIMITER MODE: Follow input with rise/fall rates
                        const target = Math.abs(sigIn[i]); // Use absolute for CV following
                        const diff = target - output;

                        if (diff > 0) {
                            // Rising toward target
                            const maxChange = 10 / (riseTime * sampleRate);
                            output += Math.min(diff, maxChange);
                        } else if (diff < 0) {
                            // Falling toward target
                            const maxChange = 10 / (fallTime * sampleRate);
                            output += Math.max(diff, -maxChange);
                        }

                        lastIn = sigIn[i];
                    } else {
                        // ENVELOPE / LFO MODE
                        // Start on trigger (only if not already rising)
                        if (trigEdge && !rising) {
                            phase = 0;
                            rising = true;
                            falling = false;
                        }

                        // Start cycling if enabled and idle
                        if (cycling && !rising && !falling && phase === 0) {
                            rising = true;
                        }

                        if (rising) {
                            // Calculate rise increment
                            const riseInc = 0.5 / (riseTime * sampleRate);
                            phase += riseInc;

                            if (phase >= 0.5) {
                                phase = 0.5;
                                rising = false;
                                falling = true;
                                // Fire EOR gate
                                eorPulseCount = GATE_PULSE_SAMPLES;
                                eor[i] = 10;
                            }
                        } else if (falling) {
                            // Calculate fall increment
                            const fallInc = 0.5 / (fallTime * sampleRate);
                            phase += fallInc;

                            if (phase >= 1) {
                                phase = 0;
                                falling = false;
                                // Fire EOC gate
                                eocPulseCount = GATE_PULSE_SAMPLES;
                                eoc[i] = 10;

                                // Restart if cycling
                                if (cycling) {
                                    rising = true;
                                }
                            }
                        }

                        // Calculate output from phase with curve shaping
                        let shaped;
                        if (phase <= 0) {
                            shaped = 0;
                        } else if (phase < 0.5) {
                            // Rising: 0 to 0.5 → 0 to 1
                            const t = phase * 2;
                            shaped = applyCurve(t, curve);
                        } else if (phase < 1) {
                            // Falling: 0.5 to 1 → 1 to 0
                            const t = (phase - 0.5) * 2;
                            shaped = 1 - applyCurve(t, curve);
                        } else {
                            shaped = 0;
                        }

                        output = shaped * 10;
                    }

                    // Clamp output
                    output = Math.max(0, Math.min(10, output));

                    out[i] = output;
                    inv[i] = 10 - output;
                }

                // LED follows output
                this.leds.level = output / 10;
            },

            reset() {
                out.fill(0);
                inv.fill(10);
                eor.fill(0);
                eoc.fill(0);
                output = 0;
                phase = 0;
                rising = false;
                falling = false;
                lastTrig = 0;
                lastIn = 0;
                hasInput = false;
                eorPulseCount = 0;
                eocPulseCount = 0;
                this.leds.level = 0;
            }
        };
    },

    ui: {
        leds: ['level'],
        knobs: [
            { id: 'rise', label: 'Rise', param: 'rise', min: 0, max: 1, default: 0.3 },
            { id: 'fall', label: 'Fall', param: 'fall', min: 0, max: 1, default: 0.3 },
            { id: 'curve', label: 'Curve', param: 'curve', min: 0, max: 1, default: 0.5 }
        ],
        switches: [
            { id: 'cycle', label: 'Cycle', param: 'cycle', positions: ['Off', 'On'], default: 0 }
        ],
        inputs: [
            { id: 'in', label: 'In', port: 'in', type: 'cv' },
            { id: 'trig', label: 'Trig', port: 'trig', type: 'trigger' },
            { id: 'riseCV', label: 'R CV', port: 'riseCV', type: 'cv' },
            { id: 'fallCV', label: 'F CV', port: 'fallCV', type: 'cv' },
            { id: 'cycleCV', label: 'Cyc', port: 'cycleCV', type: 'gate' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'cv' },
            { id: 'inv', label: 'Inv', port: 'inv', type: 'cv' },
            { id: 'eor', label: 'EOR', port: 'eor', type: 'gate' },
            { id: 'eoc', label: 'EOC', port: 'eoc', type: 'gate' }
        ]
    }
};
