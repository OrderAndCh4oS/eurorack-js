import { describe, it, expect, beforeEach } from 'vitest';
import vcaModule from '../../src/js/modules/vca/index.js';

// Helper to create VCA instance using new module system
const create2hpDualVCA = (options = {}) => vcaModule.createDSP(options);

describe('create2hpDualVCA', () => {
    let vca;

    beforeEach(() => {
        vca = create2hpDualVCA();
    });

    describe('initialization', () => {
        it('should create a VCA with default params', () => {
            expect(vca.params.ch1Gain).toBe(1);
            expect(vca.params.ch2Gain).toBe(1);
        });

        it('should create input buffers', () => {
            expect(vca.inputs.ch1In).toBeInstanceOf(Float32Array);
            expect(vca.inputs.ch2In).toBeInstanceOf(Float32Array);
            expect(vca.inputs.ch2CV).toBeInstanceOf(Float32Array);
        });

        it('should create output buffers', () => {
            expect(vca.outputs.ch1Out).toBeInstanceOf(Float32Array);
            expect(vca.outputs.ch2Out).toBeInstanceOf(Float32Array);
            expect(vca.outputs.ch1Out.length).toBe(512);
        });

        it('should have LED meters', () => {
            expect(vca.leds.ch1).toBe(0);
            expect(vca.leds.ch2).toBe(0);
        });

        it('should accept custom options', () => {
            const customVca = create2hpDualVCA({ bufferSize: 256, sampleRate: 48000 });
            expect(customVca.outputs.ch1Out.length).toBe(256);
        });
    });

    describe('gain control', () => {
        it('should pass signal at unity gain', () => {
            // Fill input with test signal
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch1In[i] = Math.sin(i * 0.1) * 5;
            }
            vca.params.ch1Gain = 1;
            vca.process();

            // Output should match input (channel 1 has no CV control)
            for (let i = 0; i < 512; i++) {
                expect(vca.outputs.ch1Out[i]).toBeCloseTo(vca.inputs.ch1In[i], 5);
            }
        });

        it('should attenuate signal with lower gain', () => {
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch1In[i] = 5;
            }
            vca.params.ch1Gain = 0.5;
            vca.process();

            expect(vca.outputs.ch1Out[0]).toBeCloseTo(2.5, 5);
        });

        it('should mute signal at zero gain', () => {
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch1In[i] = 5;
            }
            vca.params.ch1Gain = 0;
            vca.process();

            expect(vca.outputs.ch1Out[0]).toBe(0);
        });
    });

    describe('CV control (channel 2)', () => {
        it('should modulate channel 2 with CV', () => {
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch2In[i] = 5;
            }
            vca.params.ch2Gain = 1;
            vca.inputs.ch2CV.fill(5); // Fully open
            vca.process();

            // Should be near full level (CV smoothing may affect exact value)
            expect(vca.outputs.ch2Out[511]).toBeCloseTo(5, 0);
        });

        it('should close VCA with 0V CV', () => {
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch2In[i] = 5;
            }
            vca.params.ch2Gain = 1;
            vca.inputs.ch2CV.fill(0);

            // Process multiple times for CV slew to settle
            for (let i = 0; i < 10; i++) {
                vca.process();
            }

            expect(vca.outputs.ch2Out[511]).toBeCloseTo(0, 1);
        });

        it('should have linear CV response', () => {
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch2In[i] = 10; // 10V signal
            }
            vca.params.ch2Gain = 1;
            vca.inputs.ch2CV.fill(2.5); // 50% CV

            // Process multiple times for CV slew to settle
            for (let i = 0; i < 10; i++) {
                vca.process();
            }

            // Should be ~50% of input (5V)
            expect(vca.outputs.ch2Out[511]).toBeCloseTo(5, 1);
        });
    });

    describe('CV smoothing', () => {
        it('should smooth sudden CV changes', () => {
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch2In[i] = 5;
            }
            vca.params.ch2Gain = 1;

            // Start with low CV
            vca.inputs.ch2CV.fill(0);
            for (let i = 0; i < 5; i++) {
                vca.process();
            }

            // Sudden jump to high CV
            vca.inputs.ch2CV.fill(5);
            vca.process();

            // First sample shouldn't immediately jump to full (smoothing)
            expect(vca.outputs.ch2Out[0]).toBeLessThan(5);
        });
    });

    describe('LED metering', () => {
        it('should update LED levels based on output', () => {
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch1In[i] = 5;
                vca.inputs.ch2In[i] = 2.5;
            }
            vca.params.ch1Gain = 1;
            vca.params.ch2Gain = 1;
            vca.inputs.ch2CV.fill(5);
            vca.process();

            expect(vca.leds.ch1).toBeGreaterThan(0);
            expect(vca.leds.ch2).toBeGreaterThan(0);
        });

        it('should decay LED levels over time', () => {
            // First, create some output
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch1In[i] = 5;
            }
            vca.params.ch1Gain = 1;
            vca.process();
            const initialLed = vca.leds.ch1;

            // Then process with silence
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch1In[i] = 0;
            }
            vca.process();

            // LED should decay
            expect(vca.leds.ch1).toBeLessThan(initialLed);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffers', () => {
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch1In[i] = Math.random() * 10 - 5;
                vca.inputs.ch2In[i] = Math.random() * 10 - 5;
            }
            vca.process();

            expect(vca.outputs.ch1Out.every(v => !isNaN(v))).toBe(true);
            expect(vca.outputs.ch2Out.every(v => !isNaN(v))).toBe(true);
        });
    });
});
