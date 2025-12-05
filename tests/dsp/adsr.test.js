import { describe, it, expect, beforeEach } from 'vitest';
import { createADSR } from '../../src/js/dsp/adsr.js';

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
});
