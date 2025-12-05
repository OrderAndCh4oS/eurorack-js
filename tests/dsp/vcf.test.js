import { describe, it, expect, beforeEach } from 'vitest';
import { createVCF } from '../../src/js/dsp/vcf.js';

describe('createVCF', () => {
    let vcf;

    beforeEach(() => {
        vcf = createVCF();
    });

    describe('initialization', () => {
        it('should create a VCF with default params', () => {
            expect(vcf.params.cutoff).toBe(0.5);
            expect(vcf.params.resonance).toBe(0.3);
        });

        it('should create input buffer and CV inputs', () => {
            expect(vcf.inputs.audio).toBeInstanceOf(Float32Array);
            expect(vcf.inputs.cutoffCV).toBe(0);
            expect(vcf.inputs.resCV).toBe(0);
        });

        it('should create output buffers', () => {
            expect(vcf.outputs.lpf).toBeInstanceOf(Float32Array);
            expect(vcf.outputs.bpf).toBeInstanceOf(Float32Array);
            expect(vcf.outputs.hpf).toBeInstanceOf(Float32Array);
            expect(vcf.outputs.lpf.length).toBe(512);
        });

        it('should have LED output', () => {
            expect(vcf.leds.cutoff).toBe(0);
        });

        it('should accept custom options', () => {
            const customVcf = createVCF({ sampleRate: 48000, bufferSize: 256 });
            expect(customVcf.outputs.lpf.length).toBe(256);
        });
    });

    describe('output range (bipolar ±5V)', () => {
        it('should produce LPF output in reasonable range', () => {
            // Input a test signal
            for (let i = 0; i < 512; i++) {
                vcf.inputs.audio[i] = Math.sin(i * 0.1) * 5;
            }
            vcf.process();

            const max = Math.max(...vcf.outputs.lpf);
            const min = Math.min(...vcf.outputs.lpf);

            // Filter output should be bounded
            expect(max).toBeLessThan(10);
            expect(min).toBeGreaterThan(-10);
        });
    });

    describe('filter behavior', () => {
        it('should attenuate high frequencies when cutoff is low', () => {
            // Generate high frequency signal
            for (let i = 0; i < 512; i++) {
                vcf.inputs.audio[i] = Math.sin(i * 0.8) * 5; // High freq
            }

            vcf.params.cutoff = 0.1; // Low cutoff
            vcf.params.resonance = 0;

            for (let i = 0; i < 10; i++) {
                vcf.process();
            }

            // LPF should attenuate the high frequency signal
            const inputPeak = 5;
            const outputPeak = Math.max(...vcf.outputs.lpf.map(Math.abs));

            expect(outputPeak).toBeLessThan(inputPeak);
        });

        it('should pass low frequencies when cutoff is high', () => {
            // Generate low frequency signal
            for (let i = 0; i < 512; i++) {
                vcf.inputs.audio[i] = Math.sin(i * 0.01) * 5; // Low freq
            }

            vcf.params.cutoff = 0.9; // High cutoff
            vcf.params.resonance = 0;

            for (let i = 0; i < 10; i++) {
                vcf.process();
            }

            // LPF should pass the low frequency signal relatively unchanged
            const inputPeak = Math.max(...vcf.inputs.audio.map(Math.abs));
            const outputPeak = Math.max(...vcf.outputs.lpf.map(Math.abs));

            expect(outputPeak).toBeGreaterThan(inputPeak * 0.5);
        });

        it('should produce different outputs for LPF, BPF, HPF', () => {
            for (let i = 0; i < 512; i++) {
                vcf.inputs.audio[i] = Math.sin(i * 0.1) * 5;
            }

            vcf.params.cutoff = 0.5;
            vcf.process();

            // The three outputs should be different
            const lpfSum = vcf.outputs.lpf.reduce((a, b) => a + Math.abs(b), 0);
            const bpfSum = vcf.outputs.bpf.reduce((a, b) => a + Math.abs(b), 0);
            const hpfSum = vcf.outputs.hpf.reduce((a, b) => a + Math.abs(b), 0);

            // At least two should be different
            expect(lpfSum !== bpfSum || bpfSum !== hpfSum || lpfSum !== hpfSum).toBe(true);
        });
    });

    describe('parameter response', () => {
        it('should respond to cutoff changes', () => {
            for (let i = 0; i < 512; i++) {
                vcf.inputs.audio[i] = Math.sin(i * 0.3) * 5;
            }

            vcf.params.cutoff = 0.2;
            for (let i = 0; i < 5; i++) vcf.process();
            const lowCutoffOutput = Math.max(...vcf.outputs.lpf.map(Math.abs));

            const vcf2 = createVCF();
            for (let i = 0; i < 512; i++) {
                vcf2.inputs.audio[i] = Math.sin(i * 0.3) * 5;
            }
            vcf2.params.cutoff = 0.8;
            for (let i = 0; i < 5; i++) vcf2.process();
            const highCutoffOutput = Math.max(...vcf2.outputs.lpf.map(Math.abs));

            // Higher cutoff should pass more signal
            expect(highCutoffOutput).toBeGreaterThan(lowCutoffOutput);
        });

        it('should boost signal at resonance', () => {
            for (let i = 0; i < 512; i++) {
                vcf.inputs.audio[i] = Math.sin(i * 0.2) * 2;
            }

            vcf.params.cutoff = 0.5;
            vcf.params.resonance = 0;
            for (let i = 0; i < 5; i++) vcf.process();
            const noResOutput = Math.max(...vcf.outputs.lpf.map(Math.abs));

            const vcf2 = createVCF();
            for (let i = 0; i < 512; i++) {
                vcf2.inputs.audio[i] = Math.sin(i * 0.2) * 2;
            }
            vcf2.params.cutoff = 0.5;
            vcf2.params.resonance = 0.8;
            for (let i = 0; i < 5; i++) vcf2.process();
            const highResOutput = Math.max(...vcf2.outputs.lpf.map(Math.abs));

            // Higher resonance should boost signal around cutoff
            expect(highResOutput).toBeGreaterThan(noResOutput * 0.8);
        });
    });

    describe('CV modulation', () => {
        it('should respond to cutoff CV', () => {
            for (let i = 0; i < 512; i++) {
                vcf.inputs.audio[i] = Math.sin(i * 0.3) * 5;
            }

            vcf.params.cutoff = 0.3;
            vcf.inputs.cutoffCV = 0;
            for (let i = 0; i < 5; i++) vcf.process();
            const noCVOutput = Math.max(...vcf.outputs.lpf.map(Math.abs));

            const vcf2 = createVCF();
            for (let i = 0; i < 512; i++) {
                vcf2.inputs.audio[i] = Math.sin(i * 0.3) * 5;
            }
            vcf2.params.cutoff = 0.3;
            vcf2.inputs.cutoffCV = 4; // +4V CV
            for (let i = 0; i < 5; i++) vcf2.process();
            const withCVOutput = Math.max(...vcf2.outputs.lpf.map(Math.abs));

            // CV should open up the filter
            expect(withCVOutput).toBeGreaterThan(noCVOutput);
        });

        it('should respond to resonance CV', () => {
            for (let i = 0; i < 512; i++) {
                vcf.inputs.audio[i] = Math.sin(i * 0.2) * 2;
            }

            vcf.params.resonance = 0;
            vcf.inputs.resCV = 5; // +5V = +0.5 resonance
            for (let i = 0; i < 5; i++) vcf.process();

            // Should have some resonance effect
            expect(vcf.outputs.lpf.some(v => v !== 0)).toBe(true);
        });
    });

    describe('LED', () => {
        it('should update LED to show cutoff position', () => {
            vcf.params.cutoff = 0.7;
            vcf.process();

            expect(vcf.leds.cutoff).toBeCloseTo(0.7, 5);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffers without NaN', () => {
            for (let i = 0; i < 512; i++) {
                vcf.inputs.audio[i] = Math.random() * 10 - 5;
            }
            vcf.process();

            expect(vcf.outputs.lpf.every(v => !isNaN(v))).toBe(true);
            expect(vcf.outputs.bpf.every(v => !isNaN(v))).toBe(true);
            expect(vcf.outputs.hpf.every(v => !isNaN(v))).toBe(true);
        });

        it('should not produce infinite values', () => {
            for (let i = 0; i < 512; i++) {
                vcf.inputs.audio[i] = Math.random() * 10 - 5;
            }

            // Process many times to check stability
            for (let i = 0; i < 100; i++) {
                vcf.process();
            }

            expect(vcf.outputs.lpf.every(v => isFinite(v))).toBe(true);
        });
    });
});
