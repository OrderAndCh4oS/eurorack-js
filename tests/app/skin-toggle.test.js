import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CABLE_OPACITY_STORAGE_KEY,
    EurorackApp
} from '../../src/js/app/app.js';

function setupDOM() {
    document.body.innerHTML = `
        <button id="startButton"></button>
        <button id="clearCables"></button>
        <button id="midiLearnBtn"></button>
        <button id="midiControllerBtn"></button>
        <button id="midiDrumControllerBtn"></button>
        <footer class="app-footer">
            <button id="cableOpacityToggle"></button>
        </footer>
        <div id="rack-container"></div>
        <div id="rack-row-1"></div>
        <div id="rack-row-2"></div>
        <svg id="cable-svg"></svg>
    `;
}

describe('EurorackApp fixed appearance and cable opacity', () => {
    beforeEach(() => {
        setupDOM();
        document.body.className = '';
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        document.body.className = '';
        localStorage.clear();
    });

    it('defaults to the industrial light theme', () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.applySkin();

        expect(document.body.classList.contains('theme-industrial')).toBe(true);
        expect(document.body.classList.contains('theme-light')).toBe(true);
        expect(document.body.classList.contains('skin-factory')).toBe(true);
        expect(app.theme).toBe('industrial');
        expect(app.themeMode).toBe('light');
    });

    it('discards retired classic and dark preferences without affecting saved patches', () => {
        document.body.className = 'theme-classic theme-dark cables-dimmed';
        localStorage.setItem('eurorack-theme', 'classic');
        localStorage.setItem('eurorack-theme-mode', 'dark');
        localStorage.setItem('eurorack-patches', '{"saved":true}');
        const app = new EurorackApp(document);
        app.cacheElements();
        app.applySkin();

        expect(document.body.classList.contains('theme-classic')).toBe(false);
        expect(document.body.classList.contains('theme-dark')).toBe(false);
        expect(document.body.classList.contains('theme-industrial')).toBe(true);
        expect(document.body.classList.contains('theme-light')).toBe(true);
        expect(document.body.classList.contains('cables-dimmed')).toBe(true);
        expect(localStorage.getItem('eurorack-theme')).toBeNull();
        expect(localStorage.getItem('eurorack-theme-mode')).toBeNull();
        expect(localStorage.getItem('eurorack-patches')).toBe('{"saved":true}');
    });

    it('keeps Industrial Light when storage access is blocked', () => {
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
        document.body.className = 'theme-classic theme-dark';
        const app = new EurorackApp(document);
        app.cacheElements();
        expect(() => app.applySkin()).not.toThrow();
        expect(document.body.className).toBe('theme-industrial theme-light skin-factory');
    });

    it('dims cable rendering without changing the rack cable state', () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.applySavedCableOpacity();
        app.bindEvents();
        const stateCables = app.state.cables;

        expect(app.cablesFullOpacity).toBe(true);
        expect(document.getElementById('cableOpacityToggle').textContent).toBe('Cables: Full');
        expect(document.getElementById('cableOpacityToggle').getAttribute('aria-pressed')).toBe('true');

        document.getElementById('cableOpacityToggle').click();

        expect(app.cablesFullOpacity).toBe(false);
        expect(document.body.classList.contains('cables-dimmed')).toBe(true);
        expect(document.getElementById('cableOpacityToggle').classList.contains('active')).toBe(false);
        expect(document.getElementById('cableOpacityToggle').textContent).toBe('Cables: Dim');
        expect(document.getElementById('cableOpacityToggle').getAttribute('aria-pressed')).toBe('false');
        expect(localStorage.getItem(CABLE_OPACITY_STORAGE_KEY)).toBe('false');
        expect(app.state.cables).toBe(stateCables);
    });

    it('restores dimmed cable rendering from storage', () => {
        localStorage.setItem(CABLE_OPACITY_STORAGE_KEY, 'false');
        const app = new EurorackApp(document);
        app.cacheElements();
        app.applySavedCableOpacity();

        expect(app.cablesFullOpacity).toBe(false);
        expect(document.body.classList.contains('cables-dimmed')).toBe(true);
        expect(document.getElementById('cableOpacityToggle').textContent).toBe('Cables: Dim');
    });
});
