import { describe, expect, it } from 'vitest';
import { softLimitVoltage } from '../../src/js/utils/voltage.js';

describe('softLimitVoltage', () => {
    it('is linear below the configured knee', () => {
        expect(softLimitVoltage(4.8, 5)).toBe(4.8);
        expect(softLimitVoltage(-9.6, 10)).toBe(-9.6);
    });

    it('smoothly bounds overload at the configured rail', () => {
        expect(softLimitVoltage(6, 5)).toBeGreaterThan(4.8);
        expect(softLimitVoltage(6, 5)).toBeLessThanOrEqual(5);
        expect(softLimitVoltage(-100, 10)).toBeGreaterThanOrEqual(-10);
    });

    it('turns invalid values into silence', () => {
        expect(softLimitVoltage(Number.NaN, 5)).toBe(0);
        expect(softLimitVoltage(Number.POSITIVE_INFINITY, 5)).toBe(0);
    });
});
