import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EurorackApp } from '../../src/js/app/app.js';

function setupDOM() {
    document.body.innerHTML = `
        <button id="startButton"></button>
        <button id="clearCables"></button>
        <button id="copyPatch"></button>
        <button id="midiLearnBtn"></button>
        <button id="midiControllerBtn"></button>
        <button id="midiDrumControllerBtn"></button>
        <button id="addRackRow"></button>
        <button id="removeRackRow"></button>
        <div id="rack-container">
            <div class="rack rack-row" id="rack-row-1"></div>
            <div class="rack rack-row" id="rack-row-2"></div>
            <div class="rack-bottom-bar">
                <div class="cable-hints"></div>
                <footer class="app-footer"></footer>
            </div>
        </div>
        <svg id="cable-svg"></svg>
    `;
}

describe('EurorackApp rack rows', () => {
    beforeEach(() => {
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('adds and removes rack row elements from app state', () => {
        const app = new EurorackApp(document);
        app.cacheElements();

        expect(document.getElementById('rack-row-3')).toBeNull();

        expect(app.addRackRow()).toBe(3);

        const thirdRow = document.getElementById('rack-row-3');
        expect(thirdRow).not.toBeNull();
        expect(thirdRow.parentNode).toBe(document.getElementById('rack-container'));
        expect([...document.querySelectorAll('[id^="rack-row-"]')].map(row => row.id)).toEqual([
            'rack-row-1',
            'rack-row-2',
            'rack-row-3'
        ]);

        expect(app.removeRackRow()).toBe(true);

        expect(document.getElementById('rack-row-3')).toBeNull();
        expect(app.state.getRowNumbers()).toEqual([1, 2]);
    });

    it('keeps bottom controls after dynamically inserted rows', () => {
        const app = new EurorackApp(document);
        app.cacheElements();

        app.addRackRow();

        const rackContainer = document.getElementById('rack-container');
        expect(rackContainer.children[2].id).toBe('rack-row-3');
        expect(rackContainer.children[3].className).toBe('rack-bottom-bar');
    });
});
