import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyMidiToolTheme } from '../../src/js/app/midi-tool-theme.js';

describe('MIDI tool fixed Industrial Light appearance', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.documentElement.className = '';
        localStorage.clear();
    });

    it('uses the app industrial light defaults', () => {
        expect(applyMidiToolTheme()).toEqual({ theme: 'industrial', mode: 'light' });
    });

    it('removes retired classic and dark preferences', () => {
        document.documentElement.className = 'theme-classic theme-dark';
        localStorage.setItem('eurorack-theme', 'classic');
        localStorage.setItem('eurorack-theme-mode', 'dark');

        expect(applyMidiToolTheme()).toEqual({ theme: 'industrial', mode: 'light' });
        expect(document.documentElement.className).toBe('theme-industrial theme-light');
        expect(localStorage.getItem('eurorack-theme')).toBeNull();
        expect(localStorage.getItem('eurorack-theme-mode')).toBeNull();
    });

    it('still applies Industrial Light when storage access fails', () => {
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(applyMidiToolTheme()).toEqual({ theme: 'industrial', mode: 'light' });
        expect(document.documentElement.className).toBe('theme-industrial theme-light');
    });
});
