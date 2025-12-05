import { describe, it, expect } from 'vitest';
import { clamp, expMap } from '../../src/js/utils/math.js';

describe('clamp', () => {
    it('returns value when within default range (0-1)', () => {
        expect(clamp(0.5)).toBe(0.5);
    });

    it('clamps to minimum (0) by default', () => {
        expect(clamp(-1)).toBe(0);
        expect(clamp(-0.1)).toBe(0);
    });

    it('clamps to maximum (1) by default', () => {
        expect(clamp(2)).toBe(1);
        expect(clamp(1.1)).toBe(1);
    });

    it('returns exact boundary values', () => {
        expect(clamp(0)).toBe(0);
        expect(clamp(1)).toBe(1);
    });

    it('respects custom range', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-5, 0, 10)).toBe(0);
        expect(clamp(15, 0, 10)).toBe(10);
    });

    it('handles negative ranges', () => {
        expect(clamp(0, -5, 5)).toBe(0);
        expect(clamp(-10, -5, 5)).toBe(-5);
        expect(clamp(10, -5, 5)).toBe(5);
    });

    it('handles inverted range gracefully', () => {
        // When lo > hi, clamp(v, 10, 0) = min(0, max(10, v))
        // For v=5: max(10, 5)=10, min(0, 10)=0
        expect(clamp(5, 10, 0)).toBe(0);
    });
});

describe('expMap', () => {
    it('maps 0 to minimum value', () => {
        expect(expMap(0, 20, 20000)).toBe(20);
    });

    it('maps 1 to maximum value', () => {
        expect(expMap(1, 20, 20000)).toBe(20000);
    });

    it('maps 0.5 to geometric mean', () => {
        const result = expMap(0.5, 20, 20000);
        const expected = Math.sqrt(20 * 20000); // ~632.46
        expect(result).toBeCloseTo(expected, 1);
    });

    it('handles frequency range typical for filters', () => {
        // 20Hz to 20kHz with knob at 25%
        const result = expMap(0.25, 20, 20000);
        expect(result).toBeGreaterThan(20);
        expect(result).toBeLessThan(20000);
    });

    it('clamps input to 0-1 range', () => {
        expect(expMap(-0.5, 20, 20000)).toBe(20);
        expect(expMap(1.5, 20, 20000)).toBe(20000);
    });

    it('handles small ranges', () => {
        expect(expMap(0, 1, 10)).toBe(1);
        expect(expMap(1, 1, 10)).toBe(10);
    });

    it('handles LFO rate range', () => {
        // Slow range: 1/27 Hz to 20 Hz
        const slow = expMap(0.5, 1/27, 20);
        expect(slow).toBeGreaterThan(1/27);
        expect(slow).toBeLessThan(20);
    });
});
