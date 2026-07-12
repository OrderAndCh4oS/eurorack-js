import { afterEach, describe, expect, it, vi } from 'vitest';
import { EurorackApp } from '../../src/js/app/app.js';

function createJack({ direction, module, port, left }) {
    const jack = document.createElement('div');
    jack.className = `jack ${direction}`;
    Object.assign(jack.dataset, { dir: direction, module, port });
    jack.getBoundingClientRect = () => ({ left, top: 20, width: 20, height: 20 });
    document.body.appendChild(jack);
    return jack;
}

function setupCable() {
    document.body.innerHTML = '<svg id="cable-svg"></svg><div id="rack-container"></div>';
    const app = new EurorackApp(document);
    app.cacheElements();
    const fromEl = createJack({ direction: 'output', module: 'vco', port: 'triangle', left: 20 });
    const toEl = createJack({ direction: 'input', module: 'vcf', port: 'audio', left: 120 });
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.style.stroke = '#ff4a0a';
    app.cableSvg.appendChild(pathEl);
    const cable = {
        fromModule: 'vco', fromPort: 'triangle', toModule: 'vcf', toPort: 'audio',
        fromEl, toEl, pathEl
    };
    app.visualCables = [cable];
    return { app, cable, fromEl, toEl };
}

describe('cable endpoint dragging', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('restores an existing cable when its endpoint is only clicked', () => {
        const { app, cable, toEl } = setupCable();
        const remove = vi.spyOn(app, 'removeCable');

        app.startCableDrag(toEl, { clientX: 130, clientY: 30, shiftKey: false, ctrlKey: false, metaKey: false });
        expect(cable.pathEl.classList.contains('cable-detached')).toBe(true);
        app.endCableDrag(toEl);

        expect(remove).not.toHaveBeenCalled();
        expect(cable.pathEl.classList.contains('cable-detached')).toBe(false);
        expect(app.dragState).toBeNull();
    });

    it('commits an endpoint move only after a valid drag', () => {
        const { app, cable, toEl } = setupCable();
        const nextInput = createJack({ direction: 'input', module: 'vca', port: 'ch1In', left: 220 });
        const remove = vi.spyOn(app, 'removeCable').mockImplementation(() => {});
        const add = vi.spyOn(app, 'addCable').mockImplementation(() => ({}));

        app.startCableDrag(toEl, { clientX: 130, clientY: 30, shiftKey: false, ctrlKey: false, metaKey: false });
        app.updateCablePreview({ clientX: 230, clientY: 30 });
        app.endCableDrag(nextInput);

        expect(remove).toHaveBeenCalledWith(cable);
        expect(add).toHaveBeenCalledWith(cable.fromEl, nextInput, expect.objectContaining({ color: '#ff4a0a' }));
    });

    it('deletes an existing cable only after dragging its endpoint to empty space', () => {
        const { app, cable, toEl } = setupCable();
        const remove = vi.spyOn(app, 'removeCable').mockImplementation(() => {});

        app.startCableDrag(toEl, { clientX: 130, clientY: 30, shiftKey: false, ctrlKey: false, metaKey: false });
        app.updateCablePreview({ clientX: 180, clientY: 80 });
        app.endCableDrag(null);

        expect(remove).toHaveBeenCalledWith(cable);
    });

    it('restores a pending cable move when cancelled', () => {
        const { app, cable, toEl } = setupCable();
        app.startCableDrag(toEl, { clientX: 130, clientY: 30, shiftKey: false, ctrlKey: false, metaKey: false });
        app.updateCablePreview({ clientX: 180, clientY: 80 });

        app.cancelCableDrag();

        expect(cable.pathEl.classList.contains('cable-detached')).toBe(false);
        expect(app.dragState).toBeNull();
        expect(app.previewPath).toBeNull();
    });

    it('restores a cable dropped on an incompatible jack', () => {
        const { app, cable, toEl } = setupCable();
        const incompatible = createJack({ direction: 'output', module: 'lfo', port: 'primary', left: 220 });
        const remove = vi.spyOn(app, 'removeCable');

        app.startCableDrag(toEl, { clientX: 130, clientY: 30, shiftKey: false, ctrlKey: false, metaKey: false });
        app.updateCablePreview({ clientX: 230, clientY: 30 });
        app.endCableDrag(incompatible);

        expect(remove).not.toHaveBeenCalled();
        expect(cable.pathEl.classList.contains('cable-detached')).toBe(false);
    });
});
