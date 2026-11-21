import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initThemeMode } from '../../src/js/app/theme-mode.js';

describe('Industrial color mode', () => {
    let frame, doc, storage, button;

    beforeEach(() => {
        frame = document.createElement('iframe');
        document.body.append(frame);
        doc = frame.contentDocument;
        storage = doc.defaultView.localStorage;
        storage.clear();
        doc.body.className = 'theme-industrial skin-factory cables-dimmed';
        doc.body.innerHTML = '<button data-theme-mode-toggle>Dark mode</button>';
        button = doc.querySelector('button');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        storage.clear();
        frame.remove();
    });

    it('falls back to light for an invalid preference', () => {
        storage.setItem('eurorack-theme-mode', 'unknown');
        initThemeMode(doc);
        expect(doc.body.classList.contains('theme-light')).toBe(true);
        expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('restores the old dark preference under Industrial and persists toggles independently of patches', () => {
        storage.setItem('eurorack-theme', 'classic');
        storage.setItem('eurorack-theme-mode', 'dark');
        storage.setItem('eurorack-patches', '{"saved":true}');
        initThemeMode(doc);
        expect(doc.body.classList.contains('theme-dark')).toBe(true);
        expect(doc.body.classList.contains('theme-classic')).toBe(false);
        expect(storage.getItem('eurorack-theme')).toBeNull();
        expect(button.getAttribute('aria-pressed')).toBe('true');
        button.click();
        expect(doc.body.className).toBe('theme-industrial skin-factory cables-dimmed theme-light');
        expect(storage.getItem('eurorack-theme-mode')).toBe('light');
        button.click();
        expect(storage.getItem('eurorack-theme-mode')).toBe('dark');
        expect(storage.getItem('eurorack-patches')).toBe('{"saved":true}');
    });

    it('can switch both ways when access to storage is blocked', () => {
        vi.spyOn(doc.defaultView, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
        initThemeMode(doc);
        expect(button.getAttribute('aria-pressed')).toBe('false');
        button.click();
        expect(doc.body.classList.contains('theme-dark')).toBe(true);
        button.click();
        expect(doc.body.classList.contains('theme-light')).toBe(true);
    });
});
