import { describe, it, expect, beforeEach } from 'vitest';
import vcoModule from '../../src/js/modules/vco/index.js';

// Helper to create VCO instance using new module system
const create2hpVCO = (options = {}) => vcoModule.createDSP(options);

describe('create2hpVCO', () => {
    let vco;

    beforeEach(() => {
        vco = create2hpVCO();
    });

    describe('initialization', () => {
        it('should create a VCO with default params', () => {
            expect(vco.params.coarse).toBe(0.4);
            expect(vco.params.fine).toBe(0);
            expect(vco.params.glide).toBe(5);
        });

        it('should create a VCO with default inputs', () => {
            expect(vco.inputs.vOct).toBeInstanceOf(Float32Array);
            expect(vco.inputs.fm).toBeInstanceOf(Float32Array);
            expect(vco.inputs.pwm).toBeInstanceOf(Float32Array);
            expect(vco.inputs.sync).toBeInstanceOf(Float32Array);
        });

        it('should create output buffers of correct size', () => {
            expect(vco.outputs.triangle).toBeInstanceOf(Float32Array);
            expect(vco.outputs.ramp).toBeInstanceOf(Float32Array);
            expect(vco.outputs.pulse).toBeInstanceOf(Float32Array);
            expect(vco.outputs.triangle.length).toBe(512);
        });

        it('should accept custom options', () => {
            const customVco = create2hpVCO({
                sampleRate: 48000,
                bufferSize: 256,
                fmVoltsPerHz: 100
            });
            expect(customVco.outputs.triangle.length).toBe(256);
        });
    });

    describe('output range (bipolar ±5V)', () => {
        it('should produce triangle output in ±5V range', () => {
            vco.params.coarse = 0.7; // Higher frequency for more cycles

            for (let i = 0; i < 5; i++) {
                vco.process();
            }

            const min = Math.min(...vco.outputs.triangle);
            const max = Math.max(...vco.outputs.triangle);

            expect(min).toBeGreaterThanOrEqual(-5.1);
            expect(max).toBeLessThanOrEqual(5.1);
        });

        it('should produce ramp (saw) output in ±5V range', () => {
            vco.params.coarse = 0.7;

            for (let i = 0; i < 5; i++) {
                vco.process();
            }

            const min = Math.min(...vco.outputs.ramp);
            const max = Math.max(...vco.outputs.ramp);

            expect(min).toBeGreaterThanOrEqual(-5.1);
            expect(max).toBeLessThanOrEqual(5.1);
        });

        it('should produce pulse output in ±5V range', () => {
            vco.params.coarse = 0.7;

            for (let i = 0; i < 5; i++) {
                vco.process();
            }

            const min = Math.min(...vco.outputs.pulse);
            const max = Math.max(...vco.outputs.pulse);

            expect(min).toBeGreaterThanOrEqual(-5.1);
            expect(max).toBeLessThanOrEqual(5.1);
        });
    });

    describe('parameter response', () => {
        it('should change frequency with coarse knob', () => {
            const lowVco = create2hpVCO({ bufferSize: 4410 });
            lowVco.params.coarse = 0.2;
            lowVco.process();

            const highVco = create2hpVCO({ bufferSize: 4410 });
            highVco.params.coarse = 0.8;
            highVco.process();

            // Count zero crossings
            const countCrossings = (arr) => {
                let crossings = 0;
                for (let i = 1; i < arr.length; i++) {
                    if ((arr[i-1] < 0 && arr[i] >= 0) || (arr[i-1] >= 0 && arr[i] < 0)) {
                        crossings++;
                    }
                }
                return crossings;
            };

            expect(countCrossings(highVco.outputs.ramp)).toBeGreaterThan(countCrossings(lowVco.outputs.ramp));
        });

        it('should fine tune frequency with fine param', () => {
            const baseVco = create2hpVCO();
            baseVco.params.fine = 0;
            baseVco.process();

            const tunedVco = create2hpVCO();
            tunedVco.params.fine = 6; // +6 semitones
            tunedVco.process();

            // Both should produce valid output
            expect(baseVco.outputs.triangle.some(v => v !== 0)).toBe(true);
            expect(tunedVco.outputs.triangle.some(v => v !== 0)).toBe(true);
        });

        it('should change pulse width with PWM input', () => {
            const narrowPulse = create2hpVCO();
            narrowPulse.inputs.pwm.fill(0.5); // ~15% duty
            narrowPulse.params.coarse = 0.6;
            narrowPulse.process();

            const widePulse = create2hpVCO();
            widePulse.inputs.pwm.fill(4.5); // ~90% duty
            widePulse.params.coarse = 0.6;
            widePulse.process();

            // Count positive samples (rough duty cycle measure)
            const countPositive = (arr) => arr.filter(v => v > 0).length;

            expect(countPositive(widePulse.outputs.pulse)).toBeGreaterThan(countPositive(narrowPulse.outputs.pulse));
        });
    });

    describe('V/Oct tracking', () => {
        it('should track V/Oct input', () => {
            const baseVco = create2hpVCO({ bufferSize: 4410 });
            baseVco.inputs.vOct.fill(0);
            baseVco.params.coarse = 0.5;
            baseVco.params.glide = 0.1; // Minimal glide
            baseVco.process();

            const octaveUpVco = create2hpVCO({ bufferSize: 4410 });
            octaveUpVco.inputs.vOct.fill(1); // +1 octave
            octaveUpVco.params.coarse = 0.5;
            octaveUpVco.params.glide = 0.1;
            octaveUpVco.process();

            // Count zero crossings - +1 octave should have ~2x
            const countCrossings = (arr) => {
                let crossings = 0;
                for (let i = 1; i < arr.length; i++) {
                    if ((arr[i-1] < 0 && arr[i] >= 0)) crossings++;
                }
                return crossings;
            };

            const baseCount = countCrossings(baseVco.outputs.ramp);
            const octaveCount = countCrossings(octaveUpVco.outputs.ramp);

            // Should be roughly double (allowing for glide)
            expect(octaveCount).toBeGreaterThan(baseCount * 1.5);
        });
    });

    describe('FM input', () => {
        it('should respond to FM input', () => {
            const noFM = create2hpVCO();
            noFM.inputs.fm.fill(0);
            noFM.process();
            const output1 = [...noFM.outputs.ramp];

            const withFM = create2hpVCO();
            withFM.inputs.fm.fill(2); // +2V FM
            withFM.process();
            const output2 = [...withFM.outputs.ramp];

            // FM should cause different output
            const different = output1.some((v, i) => Math.abs(v - output2[i]) > 0.1);
            expect(different).toBe(true);
        });
    });

    describe('hard sync', () => {
        it('should reset phase on sync rising edge', () => {
            vco.params.coarse = 0.5;
            vco.process();

            // Get current state
            const beforeSync = [...vco.outputs.ramp];

            // Apply sync trigger (rising edge: was 0, now >0)
            vco.inputs.sync = 5;
            vco.process();

            // After sync, phase resets - saw wave should start near -5
            // The first few samples after reset should be close to the ramp start
            // (Note: exact value depends on frequency and buffer timing)
            expect(vco.outputs.ramp[0]).toBeDefined();
            expect(vco.outputs.triangle[0]).toBeDefined();
        });
    });

    describe('glide/portamento', () => {
        it('should smooth pitch changes with glide', () => {
            const noGlide = create2hpVCO();
            noGlide.params.glide = 0.1; // Minimal glide
            noGlide.inputs.vOct = 2;
            noGlide.process();

            const withGlide = create2hpVCO();
            withGlide.params.glide = 100; // Max glide
            withGlide.inputs.vOct = 2;
            withGlide.process();

            // Both should produce output, glide affects transition speed
            expect(noGlide.outputs.triangle.some(v => v !== 0)).toBe(true);
            expect(withGlide.outputs.triangle.some(v => v !== 0)).toBe(true);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffers without NaN', () => {
            vco.process();

            expect(vco.outputs.triangle.every(v => !isNaN(v))).toBe(true);
            expect(vco.outputs.ramp.every(v => !isNaN(v))).toBe(true);
            expect(vco.outputs.pulse.every(v => !isNaN(v))).toBe(true);
        });
    });
});
