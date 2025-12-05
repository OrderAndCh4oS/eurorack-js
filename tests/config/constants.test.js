import { describe, it, expect } from 'vitest';
import {
    SAMPLE_RATE,
    BUFFER,
    CABLE_COLORS,
    PATCH_STORAGE_KEY,
    BUFFER_DURATION
} from '../../src/js/config/constants.js';

describe('constants', () => {
    describe('SAMPLE_RATE', () => {
        it('should be 44100 Hz', () => {
            expect(SAMPLE_RATE).toBe(44100);
        });
    });

    describe('BUFFER', () => {
        it('should be 512 samples', () => {
            expect(BUFFER).toBe(512);
        });
    });

    describe('CABLE_COLORS', () => {
        it('should have 8 colors', () => {
            expect(CABLE_COLORS.length).toBe(8);
        });

        it('should contain valid hex colors', () => {
            CABLE_COLORS.forEach(color => {
                expect(color).toMatch(/^#[0-9a-f]{6}$/i);
            });
        });
    });

    describe('PATCH_STORAGE_KEY', () => {
        it('should be a non-empty string', () => {
            expect(typeof PATCH_STORAGE_KEY).toBe('string');
            expect(PATCH_STORAGE_KEY.length).toBeGreaterThan(0);
        });
    });

    describe('BUFFER_DURATION', () => {
        it('should be calculated from BUFFER / SAMPLE_RATE', () => {
            expect(BUFFER_DURATION).toBeCloseTo(BUFFER / SAMPLE_RATE, 10);
        });

        it('should be approximately 11.6ms', () => {
            expect(BUFFER_DURATION).toBeCloseTo(0.0116, 3);
        });
    });
});
