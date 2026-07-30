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

import { clamp } from '../../utils/math.js';

export default {
    id: 'func',
    name: 'FUNC',
    hp: 8,
    color: 'module-color-four',
    category: 'modulation',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const signalInput = new Float32Array(bufferSize);
        const trig = new Float32Array(bufferSize);
        const riseCV = new Float32Array(bufferSize);
        const fallCV = new Float32Array(bufferSize);
        const cycleCV = new Float32Array(bufferSize);
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
        let inputConnected = false;
        let eorPulseCount = 0;   // For gate pulse timing
        let eocPulseCount = 0;

        // Timing constants
        const MIN_TIME_MS = 0.5;
        const MAX_TIME_MS = 10000; // 10 seconds
        const GATE_PULSE_SAMPLES = Math.max(1, Math.round(sampleRate * 0.005)); // 5ms pulse

        // Convert knob (0-1) to time in seconds
        function knobToTime(knob, fallback) {
            // Exponential mapping: 0.5ms to 10s
            const minLog = Math.log(MIN_TIME_MS);
            const maxLog = Math.log(MAX_TIME_MS);
            const normalized = Number.isFinite(knob) ? clamp(knob, 0, 1) : fallback;
            const timeMs = Math.exp(minLog + normalized * (maxLog - minLog));
            return timeMs / 1000;
        }

        // Apply CV modulation to time (exponential, +/-5V = +/-2 octaves)
        function modulateTime(baseTime, cv) {
            const cvValue = Number.isFinite(cv) ? clamp(cv, -5, 5) : 0;
            const octaves = cvValue / 2.5; // +/-5V = +/-2 octaves
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
                in: signalInput,
                trig,
                riseCV,
                fallCV,
                cycleCV
            },

            outputs: { out, inv, eor, eoc },

            leds: { level: 0 },

            process() {
                const curve = Number.isFinite(this.params.curve)
                    ? clamp(this.params.curve, 0, 1)
                    : 0.5;
                const cycle = Number.isFinite(this.params.cycle) &&
                    this.params.cycle > 0.5;

                // Base times from knobs
                const baseRiseTime = knobToTime(this.params.rise, 0.3);
                const baseFallTime = knobToTime(this.params.fall, 0.3);

                for (let i = 0; i < bufferSize; i++) {
                    // Get modulated times
                    const riseTime = modulateTime(baseRiseTime, riseCV[i]);
                    const fallTime = modulateTime(baseFallTime, fallCV[i]);

                    // Check if cycling is enabled (panel switch OR CV gate)
                    const cycling = cycle ||
                        (Number.isFinite(cycleCV[i]) && cycleCV[i] > 2.5);

                    // Trigger detection (rising edge above 1V)
                    const trigValue = Number.isFinite(trig[i]) ? trig[i] : 0;
                    const trigHigh = trigValue >= 1;
                    const trigEdge = trigHigh && lastTrig < 1;
                    lastTrig = trigValue;

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

                    if (inputConnected) {
                        // SLEW LIMITER MODE: Follow input with rise/fall rates
                        const target = Number.isFinite(signalInput[i])
                            ? clamp(signalInput[i], 0, 10)
                            : 0;
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

                    } else {
                        // ENVELOPE / LFO MODE
                        // The simplified generator is non-retriggerable until
                        // the active Rise/Fall function completes.
                        if (trigEdge && !rising && !falling) {
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
                                eorPulseCount = GATE_PULSE_SAMPLES - 1;
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
                                eocPulseCount = GATE_PULSE_SAMPLES - 1;
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
                signalInput.fill(0);
                trig.fill(0);
                riseCV.fill(0);
                fallCV.fill(0);
                cycleCV.fill(0);
                out.fill(0);
                inv.fill(10);
                eor.fill(0);
                eoc.fill(0);
                output = 0;
                phase = 0;
                rising = false;
                falling = false;
                lastTrig = 0;
                eorPulseCount = 0;
                eocPulseCount = 0;
                this.leds.level = 0;
            },

            onInputConnected(port) {
                if (port !== 'in') return;
                inputConnected = true;
                phase = 0;
                rising = false;
                falling = false;
                eorPulseCount = 0;
                eocPulseCount = 0;
            },

            onInputDisconnected(port) {
                if (port !== 'in') return;
                inputConnected = false;
                phase = 0;
                rising = false;
                falling = false;
                eorPulseCount = 0;
                eocPulseCount = 0;
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
            { id: 'in', label: 'In', port: 'in', signal: 'cv', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'trig', label: 'Trig', port: 'trig', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'riseCV', label: 'R CV', port: 'riseCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'fallCV', label: 'F CV', port: 'fallCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'cycleCV', label: 'Cyc', port: 'cycleCV', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', signal: 'cv', voltage: { min: 0, max: 10 } },
            { id: 'inv', label: 'Inv', port: 'inv', signal: 'cv', voltage: { min: 0, max: 10 } },
            { id: 'eor', label: 'EOR', port: 'eor', signal: 'gate', voltage: { min: 0, max: 10 } },
            { id: 'eoc', label: 'EOC', port: 'eoc', signal: 'gate', voltage: { min: 0, max: 10 } }
        ]
    }
};
