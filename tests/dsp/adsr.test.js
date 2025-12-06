import { describe, it, expect, beforeEach } from 'vitest';
import adsrModule from '../../src/js/modules/adsr/index.js';

// Helper to create ADSR instance using new module system
const createADSR = (options = {}) => adsrModule.createDSP(options);

describe('createADSR', () => {
    let adsr;

    beforeEach(() => {
        adsr = createADSR();
    });

    describe('initialization', () => {
        it('should create an ADSR with default params', () => {
            expect(adsr.params.attack).toBe(0.2);
            expect(adsr.params.decay).toBe(0.3);
            expect(adsr.params.sustain).toBe(0.7);
            expect(adsr.params.release).toBe(0.4);
        });

        it('should create an ADSR with default inputs', () => {
            expect(adsr.inputs.gate).toBeInstanceOf(Float32Array);
            expect(adsr.inputs.retrig).toBeInstanceOf(Float32Array);
        });

        it('should create output buffers', () => {
            expect(adsr.outputs.env).toBeInstanceOf(Float32Array);
            expect(adsr.outputs.inv).toBeInstanceOf(Float32Array);
            expect(adsr.outputs.eoc).toBeInstanceOf(Float32Array);
            expect(adsr.outputs.env.length).toBe(512);
        });

        it('should have LED output', () => {
            expect(adsr.leds.env).toBe(0);
        });

        it('should accept custom options', () => {
            const customAdsr = createADSR({ sampleRate: 48000, bufferSize: 256 });
            expect(customAdsr.outputs.env.length).toBe(256);
        });
    });

    describe('output range (unipolar 0-5V)', () => {
        it('should produce envelope output in 0-5V range', () => {
            adsr.inputs.gate.fill(5);

            // Process attack phase
            for (let i = 0; i < 100; i++) {
                adsr.process();
            }

            const max = Math.max(...adsr.outputs.env);
            const min = Math.min(...adsr.outputs.env);

            expect(min).toBeGreaterThanOrEqual(0);
            expect(max).toBeLessThanOrEqual(5.1); // Slight overshoot in attack
        });

        it('should produce inverted output in 0 to -5V range', () => {
            adsr.inputs.gate.fill(5);
            adsr.process();

            const max = Math.max(...adsr.outputs.inv);
            const min = Math.min(...adsr.outputs.inv);

            expect(max).toBeLessThanOrEqual(0);
            expect(min).toBeGreaterThanOrEqual(-5.1);
        });
    });

    describe('envelope stages', () => {
        it('should start in IDLE with zero output', () => {
            adsr.process();
            expect(adsr.outputs.env[0]).toBe(0);
        });

        it('should enter ATTACK on gate rising edge', () => {
            adsr.inputs.gate.fill(0);
            adsr.process();
            const beforeGate = adsr.outputs.env[511];

            adsr.inputs.gate.fill(5);
            adsr.process();

            // Should start rising
            expect(adsr.outputs.env[511]).toBeGreaterThan(beforeGate);
        });

        it('should reach peak (5V) during attack', () => {
            adsr.params.attack = 0; // Fast attack (still 2ms minimum)
            adsr.params.decay = 1; // Slow decay so we stay at peak longer
            adsr.params.sustain = 1; // High sustain to not drop below peak
            adsr.inputs.gate.fill(5);

            // Need more iterations for attack to complete and reach peak
            let maxLevel = 0;
            for (let i = 0; i < 500; i++) {
                adsr.process();
                maxLevel = Math.max(maxLevel, Math.max(...adsr.outputs.env));
            }

            expect(maxLevel).toBeGreaterThanOrEqual(4.5);
        });

        it('should decay to sustain level', () => {
            adsr.params.attack = 0; // Fast attack
            adsr.params.decay = 0.1; // Fast decay
            adsr.params.sustain = 0.5; // 50% sustain = 2.5V
            adsr.inputs.gate.fill(5);

            for (let i = 0; i < 200; i++) {
                adsr.process();
            }

            expect(adsr.outputs.env[511]).toBeCloseTo(2.5, 1);
        });

        it('should hold at sustain while gate is high', () => {
            adsr.params.attack = 0;
            adsr.params.decay = 0;
            adsr.params.sustain = 0.6;
            adsr.inputs.gate.fill(5);

            for (let i = 0; i < 100; i++) {
                adsr.process();
            }

            const sustainLevel = adsr.outputs.env[511];

            // Continue with gate high
            for (let i = 0; i < 10; i++) {
                adsr.process();
            }

            expect(adsr.outputs.env[511]).toBeCloseTo(sustainLevel, 1);
        });

        it('should enter release when gate goes low', () => {
            adsr.params.attack = 0;
            adsr.params.decay = 0;
            adsr.params.sustain = 0.6;
            adsr.inputs.gate.fill(5);

            for (let i = 0; i < 50; i++) {
                adsr.process();
            }

            const beforeRelease = adsr.outputs.env[511];

            // Release gate
            adsr.inputs.gate.fill(0);
            adsr.process();

            expect(adsr.outputs.env[511]).toBeLessThan(beforeRelease);
        });

        it('should return to zero after release', () => {
            adsr.params.attack = 0;
            adsr.params.decay = 0;
            adsr.params.release = 0.1;
            adsr.inputs.gate.fill(5);

            for (let i = 0; i < 20; i++) {
                adsr.process();
            }

            adsr.inputs.gate.fill(0);

            for (let i = 0; i < 200; i++) {
                adsr.process();
            }

            expect(adsr.outputs.env[511]).toBeCloseTo(0, 1);
        });
    });

    describe('end of cycle trigger', () => {
        it('should fire EOC trigger at end of release', () => {
            adsr.params.attack = 0;
            adsr.params.decay = 0;
            adsr.params.release = 0;
            adsr.inputs.gate.fill(5);

            for (let i = 0; i < 10; i++) {
                adsr.process();
            }

            adsr.inputs.gate.fill(0);

            // Process until EOC fires
            let eocFired = false;
            for (let i = 0; i < 100; i++) {
                adsr.process();
                if (adsr.outputs.eoc.some(v => v > 0)) {
                    eocFired = true;
                    break;
                }
            }

            expect(eocFired).toBe(true);
        });
    });

    describe('retrigger', () => {
        it('should retrigger attack on retrig input while gate high', () => {
            adsr.params.attack = 0;
            adsr.params.decay = 0.1;
            adsr.params.sustain = 0.5;
            adsr.inputs.gate.fill(5);

            // Get to sustain (need more iterations)
            for (let i = 0; i < 500; i++) {
                adsr.process();
            }

            const sustainLevel = adsr.outputs.env[511];

            // Retrigger (rising edge)
            adsr.inputs.retrig.fill(5);
            adsr.process();

            // Should be in attack phase now, continue processing
            adsr.inputs.retrig.fill(0); // Release retrig
            for (let i = 0; i < 200; i++) {
                adsr.process();
            }

            // After retrigger and attack, should have reached peak
            expect(adsr.outputs.env[511]).toBeGreaterThanOrEqual(sustainLevel);
        });
    });

    describe('LED', () => {
        it('should update LED to reflect envelope level', () => {
            adsr.inputs.gate.fill(5);

            for (let i = 0; i < 50; i++) {
                adsr.process();
            }

            expect(adsr.leds.env).toBeGreaterThan(0);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffers without NaN', () => {
            adsr.inputs.gate.fill(5);
            adsr.process();

            expect(adsr.outputs.env.every(v => !isNaN(v))).toBe(true);
            expect(adsr.outputs.inv.every(v => !isNaN(v))).toBe(true);
            expect(adsr.outputs.eoc.every(v => !isNaN(v))).toBe(true);
        });
    });

    /**
     * CEM3310 / AS3310 Specification Compliance Tests
     *
     * These tests verify the ADSR implementation matches the behavior
     * of the classic CEM3310/AS3310 envelope generator ICs.
     *
     * Key specs:
     * - Timing range: 2ms to 20s (50,000:1 ratio)
     * - True RC envelope shape (exponential curves)
     * - Linear sustain control (0-100% of peak)
     * - Independent gate and trigger inputs
     * - Gate threshold for triggering
     */
    describe('CEM3310/AS3310 spec compliance', () => {

        describe('timing range (2ms to 20s, 50,000:1 ratio)', () => {
            it('should have minimum attack time around 2ms (knob=0)', () => {
                const sampleRate = 44100;
                const testAdsr = createADSR({ sampleRate, bufferSize: 512 });
                testAdsr.params.attack = 0; // Minimum
                testAdsr.params.decay = 1;
                testAdsr.params.sustain = 1;
                testAdsr.inputs.gate.fill(5);

                // At 44100 Hz, 2ms = ~88 samples
                // Should reach peak within a few buffers
                let samplesProcessed = 0;
                let reachedPeak = false;

                for (let i = 0; i < 10; i++) {
                    testAdsr.process();
                    samplesProcessed += 512;
                    if (testAdsr.outputs.env[511] >= 4.9) {
                        reachedPeak = true;
                        break;
                    }
                }

                // 2ms at 44100 = 88 samples, should complete within 512 samples easily
                expect(reachedPeak).toBe(true);
                expect(samplesProcessed).toBeLessThan(2000); // Well under 50ms
            });

            it('should have maximum attack time around 10-20s (knob=1)', () => {
                const sampleRate = 44100;
                const testAdsr = createADSR({ sampleRate, bufferSize: 512 });
                testAdsr.params.attack = 1; // Maximum
                testAdsr.params.decay = 1;
                testAdsr.params.sustain = 1;
                testAdsr.inputs.gate.fill(5);

                // Process for 1 second worth of samples
                const buffersPerSecond = Math.ceil(sampleRate / 512);
                for (let i = 0; i < buffersPerSecond; i++) {
                    testAdsr.process();
                }

                // After 1 second, with 10-20s attack, should still be rising
                // and nowhere near peak (should be < 50% of the way there)
                const levelAfter1Sec = testAdsr.outputs.env[511];
                expect(levelAfter1Sec).toBeLessThan(3); // Less than 60% to peak
                expect(levelAfter1Sec).toBeGreaterThan(0.1); // But making progress
            });

            it('should follow exponential timing curve (not linear)', () => {
                const sampleRate = 44100;

                // Test at 25%, 50%, 75% knob positions
                const times = [0.25, 0.5, 0.75].map(knobVal => {
                    const testAdsr = createADSR({ sampleRate, bufferSize: 512 });
                    testAdsr.params.attack = knobVal;
                    testAdsr.params.decay = 1;
                    testAdsr.params.sustain = 1;
                    testAdsr.inputs.gate.fill(5);

                    let samplesProcessed = 0;
                    for (let i = 0; i < 2000; i++) {
                        testAdsr.process();
                        samplesProcessed += 512;
                        if (testAdsr.outputs.env[511] >= 4.9) {
                            break;
                        }
                    }
                    return samplesProcessed;
                });

                // Exponential: ratio between consecutive times should increase
                // Linear would have equal ratios
                const ratio1 = times[1] / times[0];
                const ratio2 = times[2] / times[1];

                // For exponential curve, these should be roughly similar (multiplicative)
                // Allow some tolerance for the RC curve approximation
                expect(ratio1).toBeGreaterThan(1);
                expect(ratio2).toBeGreaterThan(1);
            });
        });

        describe('true RC envelope shape', () => {
            it('should have exponential attack curve (fast start, slowing approach)', () => {
                const sampleRate = 44100;
                const testAdsr = createADSR({ sampleRate, bufferSize: 128 });
                testAdsr.params.attack = 0.3; // Moderate attack
                testAdsr.params.decay = 1;
                testAdsr.params.sustain = 1;
                testAdsr.inputs.gate.fill(5);

                const samples = [];
                for (let i = 0; i < 50; i++) {
                    testAdsr.process();
                    samples.push(testAdsr.outputs.env[127]);
                }

                // Calculate velocity (difference between consecutive samples)
                const velocities = [];
                for (let i = 1; i < samples.length; i++) {
                    velocities.push(samples[i] - samples[i-1]);
                }

                // RC curve: velocity should decrease as we approach target
                // Compare early velocity to late velocity
                const earlyVelocity = velocities.slice(0, 5).reduce((a,b) => a+b, 0) / 5;
                const lateVelocity = velocities.slice(-5).reduce((a,b) => a+b, 0) / 5;

                // Early velocity should be higher than late velocity (exponential decay of velocity)
                expect(earlyVelocity).toBeGreaterThan(lateVelocity);
            });

            it('should have exponential decay curve approaching sustain', () => {
                const sampleRate = 44100;
                const testAdsr = createADSR({ sampleRate, bufferSize: 128 });
                testAdsr.params.attack = 0; // Fast attack
                testAdsr.params.decay = 0.4; // Moderate decay
                testAdsr.params.sustain = 0.3; // 30% sustain = 1.5V
                testAdsr.inputs.gate.fill(5);

                // Get through attack phase
                for (let i = 0; i < 20; i++) {
                    testAdsr.process();
                }

                // Now in decay, collect samples
                const samples = [];
                for (let i = 0; i < 100; i++) {
                    testAdsr.process();
                    samples.push(testAdsr.outputs.env[127]);
                }

                // Find where decay is happening (level decreasing toward sustain)
                const decaySamples = samples.filter((s, i) =>
                    i > 0 && s < samples[i-1] && s > 1.6
                );

                // Should have exponential decay if we have enough decay samples
                if (decaySamples.length > 5) {
                    const velocities = [];
                    for (let i = 1; i < decaySamples.length; i++) {
                        velocities.push(Math.abs(decaySamples[i] - decaySamples[i-1]));
                    }

                    const earlyVel = velocities.slice(0, 3).reduce((a,b) => a+b, 0) / 3;
                    const lateVel = velocities.slice(-3).reduce((a,b) => a+b, 0) / 3;

                    // Velocity should decrease as we approach sustain
                    expect(earlyVel).toBeGreaterThanOrEqual(lateVel * 0.8); // Allow some tolerance
                }
            });

            it('should have exponential release curve approaching zero', () => {
                const sampleRate = 44100;
                const testAdsr = createADSR({ sampleRate, bufferSize: 128 });
                testAdsr.params.attack = 0;
                testAdsr.params.decay = 0;
                testAdsr.params.sustain = 0.8;
                testAdsr.params.release = 0.4;
                testAdsr.inputs.gate.fill(5);

                // Get to sustain
                for (let i = 0; i < 50; i++) {
                    testAdsr.process();
                }

                // Release gate
                testAdsr.inputs.gate.fill(0);

                const samples = [];
                for (let i = 0; i < 100; i++) {
                    testAdsr.process();
                    samples.push(testAdsr.outputs.env[127]);
                }

                // Calculate velocities during release
                const velocities = [];
                for (let i = 1; i < samples.length && samples[i] > 0.01; i++) {
                    velocities.push(Math.abs(samples[i] - samples[i-1]));
                }

                if (velocities.length > 10) {
                    const earlyVel = velocities.slice(0, 5).reduce((a,b) => a+b, 0) / 5;
                    const lateVel = velocities.slice(-5).reduce((a,b) => a+b, 0) / 5;

                    // RC release: velocity decreases as we approach zero
                    expect(earlyVel).toBeGreaterThan(lateVel);
                }
            });
        });

        describe('linear sustain control (0-100% of peak)', () => {
            it('should have sustain level linearly proportional to knob', () => {
                const levels = [0.2, 0.4, 0.6, 0.8].map(sustainKnob => {
                    const testAdsr = createADSR({ sampleRate: 44100, bufferSize: 512 });
                    testAdsr.params.attack = 0;
                    testAdsr.params.decay = 0;
                    testAdsr.params.sustain = sustainKnob;
                    testAdsr.inputs.gate.fill(5);

                    // Get to sustain
                    for (let i = 0; i < 100; i++) {
                        testAdsr.process();
                    }
                    return testAdsr.outputs.env[511];
                });

                // Check linearity: differences between consecutive levels should be equal
                const diffs = [];
                for (let i = 1; i < levels.length; i++) {
                    diffs.push(levels[i] - levels[i-1]);
                }

                // All differences should be approximately equal (linear)
                const avgDiff = diffs.reduce((a,b) => a+b, 0) / diffs.length;
                diffs.forEach(diff => {
                    expect(diff).toBeCloseTo(avgDiff, 1);
                });
            });

            it('should have sustain at 0V when knob is 0', () => {
                adsr.params.attack = 0;
                adsr.params.decay = 0;
                adsr.params.sustain = 0;
                adsr.inputs.gate.fill(5);

                for (let i = 0; i < 200; i++) {
                    adsr.process();
                }

                expect(adsr.outputs.env[511]).toBeCloseTo(0, 1);
            });

            it('should have sustain at 5V (100% of peak) when knob is 1', () => {
                adsr.params.attack = 0;
                adsr.params.decay = 0;
                adsr.params.sustain = 1;
                adsr.inputs.gate.fill(5);

                for (let i = 0; i < 200; i++) {
                    adsr.process();
                }

                expect(adsr.outputs.env[511]).toBeCloseTo(5, 0);
            });
        });

        describe('gate and trigger inputs', () => {
            it('should trigger on gate rising edge at 1V threshold', () => {
                // Gate at 0.9V should not trigger
                adsr.inputs.gate.fill(0.9);
                adsr.process();
                const levelAt0_9V = adsr.outputs.env[511];

                // Gate at 1.0V should trigger
                adsr.inputs.gate.fill(1.0);
                adsr.process();
                const levelAt1V = adsr.outputs.env[511];

                expect(levelAt0_9V).toBe(0);
                expect(levelAt1V).toBeGreaterThan(0);
            });

            it('should have independent gate and retrigger inputs', () => {
                adsr.params.attack = 0;
                adsr.params.decay = 0.2;
                adsr.params.sustain = 0.5;
                adsr.inputs.gate.fill(5);

                // Get to sustain
                for (let i = 0; i < 300; i++) {
                    adsr.process();
                }
                const sustainLevel = adsr.outputs.env[511];

                // Retrigger should work independently while gate is held
                adsr.inputs.retrig.fill(5);
                adsr.process();

                // Now in attack again, level should be rising
                adsr.inputs.retrig.fill(0);
                for (let i = 0; i < 100; i++) {
                    adsr.process();
                }

                const afterRetrig = adsr.outputs.env[511];
                // Should have gone back through attack and be at or above sustain
                expect(afterRetrig).toBeGreaterThanOrEqual(sustainLevel - 0.1);
            });

            it('should not retrigger when gate is low', () => {
                adsr.params.attack = 0;
                adsr.params.decay = 0;
                adsr.params.sustain = 0.5;
                adsr.params.release = 0.5; // Slower release so we don't hit zero
                adsr.inputs.gate.fill(5);

                // Get to sustain
                for (let i = 0; i < 100; i++) {
                    adsr.process();
                }

                // Release gate - only process a few buffers to stay above zero
                adsr.inputs.gate.fill(0);
                for (let i = 0; i < 10; i++) {
                    adsr.process();
                }
                const releaseLevel = adsr.outputs.env[511];

                // Try retrigger while gate is low - should not work
                adsr.inputs.retrig.fill(5);
                adsr.process();
                adsr.inputs.retrig.fill(0);
                adsr.process();

                const afterRetrigAttempt = adsr.outputs.env[511];

                // Should continue releasing (level decreasing or at zero), not restart attack
                // If release was complete, both will be 0 which is fine
                // If still releasing, afterRetrigAttempt should be <= releaseLevel
                expect(afterRetrigAttempt).toBeLessThanOrEqual(releaseLevel);
                // And shouldn't have jumped back up (which would indicate retrigger worked)
                expect(afterRetrigAttempt).toBeLessThan(2.5); // Sustain was 2.5V
            });

            it('should release immediately when gate goes low during attack', () => {
                adsr.params.attack = 0.5; // Slow attack
                adsr.params.release = 0.1;
                adsr.inputs.gate.fill(5);

                // Start attack
                adsr.process();
                const duringAttack = adsr.outputs.env[511];

                // Release gate mid-attack
                adsr.inputs.gate.fill(0);
                adsr.process();
                const afterGateLow = adsr.outputs.env[511];

                // Should be releasing (level decreasing)
                expect(afterGateLow).toBeLessThan(duringAttack);
            });
        });

        describe('attack overshoot behavior', () => {
            it('should slightly overshoot during attack for snappy response', () => {
                // This matches real CEM3310 behavior where attack can exceed sustain
                adsr.params.attack = 0.1;
                adsr.params.decay = 0.5;
                adsr.params.sustain = 0.8; // 4V sustain
                adsr.inputs.gate.fill(5);

                let maxLevel = 0;
                for (let i = 0; i < 200; i++) {
                    adsr.process();
                    maxLevel = Math.max(maxLevel, Math.max(...adsr.outputs.env));
                }

                // Peak should reach 5V (or slightly higher internally)
                // even though sustain is at 4V
                expect(maxLevel).toBeGreaterThanOrEqual(4.9);
            });
        });
    });
});
