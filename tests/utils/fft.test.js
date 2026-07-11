import { describe, expect, it } from 'vitest';
import { createRealFft } from '../../src/js/utils/fft.js';

describe('real FFT analyzer', () => {
    it('calibrates a coherent 5 V peak sine to 0 dBFS', () => {
        const size = 1024;
        const bin = 32;
        const input = Float32Array.from({ length: size }, (_, index) => (
            5 * Math.sin(2 * Math.PI * bin * index / size)
        ));
        const output = new Float32Array(size / 2);
        createRealFft({ size }).analyzeCircular(input, 0, output);

        expect(output[bin]).toBeCloseTo(0, 1);
        expect(output[bin]).toBeGreaterThan(output[bin + 4] + 40);
    });

    it('handles circular rotation and floors silence', () => {
        const fft = createRealFft({ size: 64 });
        const output = new Float32Array(32);
        fft.analyzeCircular(new Float32Array(64), 17, output);
        expect(output.every(value => value === -100)).toBe(true);
    });

    it('rejects invalid calibration and analysis buffers', () => {
        expect(() => createRealFft({ size: 64, referenceVoltage: 0 })).toThrow(/referenceVoltage/);
        const fft = createRealFft({ size: 64 });
        expect(() => fft.analyzeCircular(new Float32Array(32), 0, new Float32Array(32))).toThrow(/input/);
        expect(() => fft.analyzeCircular(new Float32Array(64), Number.NaN, new Float32Array(32))).toThrow(/writeIndex/);
    });
});
