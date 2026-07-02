import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EurorackApp } from '../../src/js/app/app.js';

function setupDOM() {
    document.body.innerHTML = `
        <button id="startButton"></button>
        <button id="clearCables"></button>
        <button id="copyPatch"></button>
        <button id="midiLearnBtn"></button>
        <button id="midiControllerBtn"></button>
        <button id="midiDrumControllerBtn"></button>
        <div id="rack-container"></div>
        <div id="rack-row-1"></div>
        <div id="rack-row-2"></div>
        <svg id="cable-svg"></svg>
    `;
}

describe('EurorackApp cable scroll handling', () => {
    beforeEach(() => {
        setupDOM();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('rerenders cable paths when the rack container scrolls', () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        const renderSpy = vi.spyOn(app, 'renderAllCables');
        app.bindEvents();

        document.getElementById('rack-container').dispatchEvent(new Event('scroll'));

        expect(renderSpy).toHaveBeenCalledOnce();
    });
});
