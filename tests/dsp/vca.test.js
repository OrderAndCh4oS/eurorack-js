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
            expect(vca.params.ch1Gain).toBe(0.8);
            expect(vca.params.ch2Gain).toBe(0.8);
            expect(vca.params.ch1Gain).toBe(vcaModule.ui.knobs[0].default);
            expect(vca.params.ch2Gain).toBe(vcaModule.ui.knobs[1].default);
        });

        it('should create input buffers', () => {
            expect(vca.inputs.ch1In).toBeInstanceOf(Float32Array);
            expect(vca.inputs.ch2In).toBeInstanceOf(Float32Array);
            expect(vca.inputs.ch1CV).toBeInstanceOf(Float32Array);
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

        it('declares DC-coupled signal ports for audio or CV', () => {
            expect(vcaModule.ui.inputs.filter(port => port.id.endsWith('In')).map(port => port.signal)).toEqual(['any', 'any']);
            expect(vcaModule.ui.outputs.map(port => port.signal)).toEqual(['any', 'any']);
            expect(vcaModule.ui.inputs.filter(port => port.id.endsWith('In')).map(port => port.voltage))
                .toEqual([
                    { min: -10, max: 10, normal: 0 },
                    { min: -10, max: 10, normal: 0 }
                ]);
            expect(vcaModule.ui.outputs.map(port => port.voltage))
                .toEqual([{ min: -10, max: 10 }, { min: -10, max: 10 }]);
        });
    });

    describe('gain control', () => {
        it('should pass signal at unity gain', () => {
            // Fill input with test signal
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch1In[i] = Math.sin(i * 0.1) * 5;
            }
            vca.params.ch1Gain = 1;
            vca.inputs.ch1CV.fill(5); // Fully open

            // Process multiple times for CV slew to settle
            for (let j = 0; j < 10; j++) {
                vca.process();
            }

            // Output should match input at end of buffer
            expect(vca.outputs.ch1Out[511]).toBeCloseTo(vca.inputs.ch1In[511], 1);
        });

        it('should attenuate signal with lower gain', () => {
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch1In[i] = 5;
            }
            vca.params.ch1Gain = 0.5;
            vca.inputs.ch1CV.fill(5); // Fully open

            // Process multiple times for CV slew to settle
            for (let j = 0; j < 10; j++) {
                vca.process();
            }

            expect(vca.outputs.ch1Out[511]).toBeCloseTo(2.5, 1);
        });

        it('should mute signal at zero gain', () => {
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch1In[i] = 5;
            }
            vca.params.ch1Gain = 0;
            vca.inputs.ch1CV.fill(5); // Fully open
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
        it('starts an unpatched 5V-normalled channel at its selected gain', () => {
            vca.params.ch1Gain = 1;
            vca.inputs.ch1In.fill(5);

            vca.process();

            expect(vca.outputs.ch1Out[0]).toBeCloseTo(5, 6);
        });

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
            vca.inputs.ch1CV.fill(5);
            vca.inputs.ch2CV.fill(5);

            // Process multiple times for CV slew to settle
            for (let j = 0; j < 10; j++) {
                vca.process();
            }

            expect(vca.leds.ch1).toBeGreaterThan(0);
            expect(vca.leds.ch2).toBeGreaterThan(0);
        });

        it('should decay LED levels over time', () => {
            // First, create some output
            for (let i = 0; i < 512; i++) {
                vca.inputs.ch1In[i] = 5;
            }
            vca.params.ch1Gain = 1;
            vca.inputs.ch1CV.fill(5);

            // Process multiple times for CV slew to settle
            for (let j = 0; j < 10; j++) {
                vca.process();
            }
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

        it('recovers safely from non-finite controls and samples', () => {
            vca.params.ch1Gain = Number.NaN;
            vca.params.ch2Gain = Number.POSITIVE_INFINITY;
            vca.inputs.ch1In.fill(Number.NaN);
            vca.inputs.ch2In.fill(Number.POSITIVE_INFINITY);
            vca.inputs.ch1CV.fill(Number.NaN);
            vca.inputs.ch2CV.fill(Number.NEGATIVE_INFINITY);

            vca.process();

            expect(vca.outputs.ch1Out.every(Number.isFinite)).toBe(true);
            expect(vca.outputs.ch2Out.every(Number.isFinite)).toBe(true);
            expect(Number.isFinite(vca.leds.ch1)).toBe(true);
            expect(Number.isFinite(vca.leds.ch2)).toBe(true);
        });
    });

    describe('reset', () => {
        it('clears stable buffers and restores the 5V CV normals', () => {
            const inputs = { ...vca.inputs };
            const outputs = { ...vca.outputs };
            Object.values(vca.inputs).forEach(buffer => buffer.fill(2));
            vca.process();

            vca.reset();

            for (const key of ['ch1In', 'ch2In', 'ch1CV', 'ch2CV']) {
                expect(vca.inputs[key]).toBe(inputs[key]);
            }
            for (const key of ['ch1Out', 'ch2Out']) {
                expect(vca.outputs[key]).toBe(outputs[key]);
                expect(vca.outputs[key].every(value => value === 0)).toBe(true);
            }
            expect(vca.inputs.ch1In.every(value => value === 0)).toBe(true);
            expect(vca.inputs.ch2In.every(value => value === 0)).toBe(true);
            expect(vca.inputs.ch1CV.every(value => value === 5)).toBe(true);
            expect(vca.inputs.ch2CV.every(value => value === 5)).toBe(true);
            expect(vca.leds).toEqual({ ch1: 0, ch2: 0 });

            vca.params.ch1Gain = 1;
            vca.inputs.ch1In.fill(4);
            vca.process();
            expect(vca.outputs.ch1Out[0]).toBeCloseTo(4, 6);
        });
    });
});
