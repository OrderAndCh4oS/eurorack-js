import { describe, it, expect } from 'vitest';
import { adjustColor } from '../../src/js/utils/color.js';

describe('adjustColor', () => {
    it('returns same color with zero adjustment', () => {
        expect(adjustColor('#ff5500', 0)).toBe('#ff5500');
    });

    it('brightens color with positive amount', () => {
        const result = adjustColor('#808080', 16);
        expect(result).toBe('#909090');
    });

    it('darkens color with negative amount', () => {
        const result = adjustColor('#808080', -16);
        expect(result).toBe('#707070');
    });

    it('clamps to maximum white', () => {
        const result = adjustColor('#f0f0f0', 100);
        expect(result).toBe('#ffffff');
    });

    it('clamps to minimum black', () => {
        const result = adjustColor('#101010', -100);
        expect(result).toBe('#000000');
    });

    it('handles pure colors', () => {
        expect(adjustColor('#ff0000', 50)).toBe('#ff3232');
        expect(adjustColor('#00ff00', 50)).toBe('#32ff32');
        expect(adjustColor('#0000ff', 50)).toBe('#3232ff');
    });

    it('handles module colors from the app', () => {
        // LFO color
        const lfoColor = '#2a5a3a';
        const darkened = adjustColor(lfoColor, -30);
        expect(darkened).not.toBe(lfoColor);
        expect(darkened.length).toBe(7);
        expect(darkened.startsWith('#')).toBe(true);
    });

    it('returns valid hex format', () => {
        const result = adjustColor('#123456', 20);
        expect(result).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('handles black', () => {
        expect(adjustColor('#000000', 0)).toBe('#000000');
        expect(adjustColor('#000000', 50)).toBe('#323232');
    });

    it('handles white', () => {
        expect(adjustColor('#ffffff', 0)).toBe('#ffffff');
        expect(adjustColor('#ffffff', -50)).toBe('#cdcdcd');
    });
});
