import { describe, it, expect } from 'vitest';
import {
    adjustColor,
    getModuleColorToken,
    isHexColor,
    isModuleColorToken,
    MODULE_COLOR_TOKENS
} from '../../src/js/utils/color.js';

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

describe('module color tokens', () => {
    it('defines the shared 12-color module palette contract', () => {
        expect(MODULE_COLOR_TOKENS).toHaveLength(12);
        expect(MODULE_COLOR_TOKENS).toEqual([
            'module-color-one',
            'module-color-two',
            'module-color-three',
            'module-color-four',
            'module-color-five',
            'module-color-six',
            'module-color-seven',
            'module-color-eight',
            'module-color-nine',
            'module-color-ten',
            'module-color-eleven',
            'module-color-twelve'
        ]);
    });

    it('identifies valid module color tokens', () => {
        expect(isModuleColorToken('module-color-one')).toBe(true);
        expect(isModuleColorToken('module-color-twelve')).toBe(true);
        expect(isModuleColorToken('module-color-thirteen')).toBe(false);
        expect(isModuleColorToken('#5a5a5a')).toBe(false);
    });

    it('accepts six-digit hex as the compatibility fallback', () => {
        expect(isHexColor('#5a5a5a')).toBe(true);
        expect(isHexColor('#ABCDEF')).toBe(true);
        expect(isHexColor('#333')).toBe(false);
        expect(isHexColor('module-color-one')).toBe(false);
    });

    it('returns a token only for token-backed module colors', () => {
        expect(getModuleColorToken('module-color-four')).toBe('module-color-four');
        expect(getModuleColorToken('#4a6741')).toBeNull();
    });
});
