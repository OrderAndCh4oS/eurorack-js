import { describe, expect, it } from 'vitest';
import { createLinearCircularReader, linearInterpolate } from '../../src/js/utils/interpolation.js';

describe('interpolation utilities', () => {
    it('linearly interpolates between two samples', () => {
        expect(linearInterpolate(2, 6, 0)).toBe(2);
        expect(linearInterpolate(2, 6, 0.25)).toBe(3);
        expect(linearInterpolate(2, 6, 1)).toBe(6);
    });

    it('reads fractional positions across either circular boundary', () => {
        const buffer = Float32Array.from([0, 10, 20, 30]);
        const read = createLinearCircularReader(buffer);
        expect(read(1.5)).toBe(15);
        expect(read(3.5)).toBe(15);
        expect(read(-0.5)).toBe(15);
    });

    it('rejects empty buffers and invalid positions', () => {
        expect(() => createLinearCircularReader(new Float32Array())).toThrow(/non-empty/);
        const read = createLinearCircularReader(new Float32Array(2));
        expect(() => read(Number.NaN)).toThrow(/finite/);
    });
});
