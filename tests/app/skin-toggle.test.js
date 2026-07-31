import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    CABLE_OPACITY_STORAGE_KEY,
    EurorackApp,
    THEME_MODE_STORAGE_KEY,
    THEME_STORAGE_KEY
} from '../../src/js/app/app.js';

function setupDOM() {
    document.body.innerHTML = `
        <button id="startButton"></button>
        <button id="clearCables"></button>
        <button id="copyPatch"></button>
        <button id="midiLearnBtn"></button>
        <button id="midiControllerBtn"></button>
        <button id="midiDrumControllerBtn"></button>
        <footer class="app-footer">
            <select id="themeSelect">
                <option value="industrial">Industrial</option>
                <option value="classic">Classic</option>
            </select>
            <button id="themeModeToggle"></button>
            <button id="cableOpacityToggle"></button>
        </footer>
        <div id="rack-container"></div>
        <div id="rack-row-1"></div>
        <div id="rack-row-2"></div>
        <svg id="cable-svg"></svg>
    `;
}

describe('EurorackApp skin toggle', () => {
    beforeEach(() => {
        setupDOM();
        document.body.className = '';
        localStorage.clear();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
        localStorage.clear();
    });

    it('defaults to the industrial light theme', () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.applySavedSkin();

        expect(document.body.classList.contains('theme-industrial')).toBe(true);
        expect(document.body.classList.contains('theme-light')).toBe(true);
        expect(document.body.classList.contains('skin-factory')).toBe(true);
        expect(document.getElementById('themeSelect').value).toBe('industrial');
        expect(document.getElementById('themeModeToggle').textContent).toBe('Dark: Off');
    });

    it('selects and persists the theme from the footer', () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.applySavedSkin();
        app.bindEvents();

        document.getElementById('themeSelect').value = 'classic';
        document.getElementById('themeSelect').dispatchEvent(new Event('change'));

        expect(document.body.classList.contains('theme-classic')).toBe(true);
        expect(document.body.classList.contains('skin-factory')).toBe(false);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('classic');
    });

    it('toggles and persists dark mode from the footer', () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.applySavedSkin();
        app.bindEvents();

        document.getElementById('themeModeToggle').click();

        expect(document.body.classList.contains('theme-dark')).toBe(true);
        expect(document.body.classList.contains('theme-light')).toBe(false);
        expect(document.getElementById('themeModeToggle').classList.contains('active')).toBe(true);
        expect(document.getElementById('themeModeToggle').textContent).toBe('Dark: On');
        expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');
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
