import { describe, it, expect } from 'vitest';
import {
    FACTORY_DARK_MODULE_SHADES,
    FACTORY_MODULE_SHADES,
    adjustColor,
    getFactoryModuleDarkHeaderShade,
    getFactoryModuleDarkShade,
    getFactoryModuleHeaderShade,
    getFactoryModuleShade
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

describe('factory module shades', () => {
    it('includes the factory paper white as a possible module shade', () => {
        expect(FACTORY_MODULE_SHADES).toContain('#f0eee2');
    });

    it('returns stable flat warm shades by seed', () => {
        const shade = getFactoryModuleShade('vco');
        expect(shade).toBe(getFactoryModuleShade('vco'));
        expect(FACTORY_MODULE_SHADES).toContain(shade);
    });

    it('returns a lighter header shade for the same seed', () => {
        const shade = getFactoryModuleShade('vco');
        const header = getFactoryModuleHeaderShade('vco');

        expect(header).toMatch(/^#[0-9a-f]{6}$/);
        expect(header).not.toBe(shade);
    });

    it('returns stable dark industrial shades by seed', () => {
        const shade = getFactoryModuleDarkShade('vco');
        expect(shade).toBe(getFactoryModuleDarkShade('vco'));
        expect(FACTORY_DARK_MODULE_SHADES).toContain(shade);
        expect(FACTORY_DARK_MODULE_SHADES.length).toBeGreaterThan(FACTORY_MODULE_SHADES.length);
    });

    it('keeps dark industrial shades varied but below midtone brightness', () => {
        const brightestChannels = FACTORY_DARK_MODULE_SHADES.map(shade => {
            const value = parseInt(shade.slice(1), 16);
            const r = value >> 16;
            const g = (value >> 8) & 0xff;
            const b = value & 0xff;
            return Math.max(r, g, b);
        });

        FACTORY_DARK_MODULE_SHADES.forEach(shade => {
            const value = parseInt(shade.slice(1), 16);
            const r = value >> 16;
            const g = (value >> 8) & 0xff;
            const b = value & 0xff;
            expect(Math.max(r, g, b)).toBeLessThanOrEqual(42);
        });

        expect(Math.max(...brightestChannels) - Math.min(...brightestChannels)).toBeGreaterThanOrEqual(24);
    });

    it('returns a lighter dark header shade for the same seed', () => {
        const shade = getFactoryModuleDarkShade('vco');
        const header = getFactoryModuleDarkHeaderShade('vco');

        expect(header).toMatch(/^#[0-9a-f]{6}$/);
        expect(header).not.toBe(shade);
    });
});
