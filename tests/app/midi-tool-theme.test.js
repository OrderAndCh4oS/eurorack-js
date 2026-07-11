import { afterEach, describe, expect, it } from 'vitest';
import {
    applyMidiToolTheme,
    readMidiToolTheme,
    THEME_MODE_STORAGE_KEY,
    THEME_STORAGE_KEY
} from '../../src/js/app/midi-tool-theme.js';

describe('MIDI tool theme synchronization', () => {
    afterEach(() => {
        document.documentElement.className = '';
        localStorage.clear();
    });

    it('uses the app industrial light defaults', () => {
        expect(readMidiToolTheme()).toEqual({ theme: 'industrial', mode: 'light' });
    });

    it('applies the saved classic dark theme', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'classic');
        localStorage.setItem(THEME_MODE_STORAGE_KEY, 'dark');

        expect(applyMidiToolTheme()).toEqual({ theme: 'classic', mode: 'dark' });
        expect(document.documentElement.classList.contains('theme-classic')).toBe(true);
        expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    });

    it('falls back when storage access fails', () => {
        const storage = { getItem() { throw new Error('blocked'); } };
        expect(readMidiToolTheme(storage)).toEqual({ theme: 'industrial', mode: 'light' });
    });
});
