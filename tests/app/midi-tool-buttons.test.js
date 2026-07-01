import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EurorackApp } from '../../src/js/app/app.js';

describe('MIDI tool launch buttons', () => {
    let openSpy;

    beforeEach(() => {
        document.body.innerHTML = `
            <button id="startButton"></button>
            <button id="clearCables"></button>
            <button id="copyPatch"></button>
            <button id="midiLearnBtn"></button>
            <button id="midiControllerBtn"></button>
            <button id="midiDrumControllerBtn"></button>
            <div id="rack-row-1"></div>
            <div id="rack-row-2"></div>
            <svg id="cable-svg"></svg>
        `;
        openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
        openSpy.mockRestore();
        document.body.innerHTML = '';
    });

    it('opens MIDI controller pages in new tabs', () => {
        const app = new EurorackApp(document);
        app.cacheElements();
        app.bindEvents();

        document.getElementById('midiControllerBtn').click();
        document.getElementById('midiDrumControllerBtn').click();

        expect(openSpy).toHaveBeenNthCalledWith(1, 'midi-controller.html', '_blank', 'noopener,noreferrer');
        expect(openSpy).toHaveBeenNthCalledWith(2, 'midi-drum-controller.html', '_blank', 'noopener,noreferrer');
    });
});
