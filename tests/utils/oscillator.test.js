import { describe, expect, it } from 'vitest';
import { polyBlep, wrapPhase } from '../../src/js/utils/oscillator.js';

describe('oscillator utilities', () => {
    it('wraps normalized phase in both directions', () => {
        expect(wrapPhase(1.25)).toBe(0.25);
        expect(wrapPhase(-0.25)).toBe(0.75);
        expect(wrapPhase(1)).toBe(0);
    });

    it('returns a PolyBLEP correction only around the discontinuity', () => {
        expect(polyBlep(0.5, 0.1)).toBe(0);
        expect(polyBlep(0, 0.1)).toBe(-1);
        expect(polyBlep(1, 0.1)).toBe(1);
    });

    it('disables PolyBLEP correction for invalid increments', () => {
        expect(polyBlep(0, 0)).toBe(0);
        expect(polyBlep(0, Number.NaN)).toBe(0);
    });
});
