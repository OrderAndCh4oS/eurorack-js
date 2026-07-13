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

    it('fans out a connected output when it is dragged to another input', () => {
        const { app, cable, fromEl } = setupCable();
        const nextInput = createJack({ direction: 'input', module: 'vca', port: 'ch1In', left: 220 });
        const remove = vi.spyOn(app, 'removeCable');
        const add = vi.spyOn(app, 'addCable').mockImplementation(() => ({}));

        app.startCableDrag(fromEl, { clientX: 30, clientY: 30, shiftKey: false, ctrlKey: false, metaKey: false });
        app.updateCablePreview({ clientX: 230, clientY: 30 });
        app.endCableDrag(nextInput);

        expect(remove).not.toHaveBeenCalled();
        expect(cable.pathEl.classList.contains('cable-detached')).toBe(false);
        expect(add).toHaveBeenCalledWith(fromEl, nextInput, expect.objectContaining({ color: expect.any(String) }));
    });

    it('keeps an occupied input cable when its replacement is rejected', () => {
        const { app, cable } = setupCable();
        const nextOutput = createJack({ direction: 'output', module: 'lfo', port: 'primary', left: 220 });
        app.host.connect = vi.fn(() => null);
        app.host.disconnect = vi.fn();

        const result = app.addCable(nextOutput, cable.toEl, { replaceInput: true });

        expect(result).toBeNull();
        expect(app.visualCables).toEqual([cable]);
        expect(cable.pathEl.isConnected).toBe(true);
        expect(app.host.disconnect).not.toHaveBeenCalled();
    });

    it('removes an occupied input visual only after its replacement is accepted', () => {
        const { app, cable } = setupCable();
        const nextOutput = createJack({ direction: 'output', module: 'lfo', port: 'primary', left: 220 });
        app.host.connect = vi.fn(connection => connection);
        app.host.disconnect = vi.fn();

        const result = app.addCable(nextOutput, cable.toEl, { replaceInput: true });

        expect(result).not.toBeNull();
        expect(app.visualCables).not.toContain(cable);
        expect(cable.pathEl.isConnected).toBe(false);
        expect(app.host.disconnect).not.toHaveBeenCalled();
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

    it('moves a selected source end when a connected output is ctrl-dragged', () => {
        const { app, cable, fromEl, toEl } = setupCable();
        const nextOutput = createJack({ direction: 'output', module: 'lfo', port: 'primary', left: 220 });
        const remove = vi.spyOn(app, 'removeCable').mockImplementation(() => {});
        const add = vi.spyOn(app, 'addCable').mockImplementation(() => ({}));

        app.startCableDrag(fromEl, { clientX: 30, clientY: 30, shiftKey: false, ctrlKey: true, metaKey: false });
        app.updateCablePreview({ clientX: 230, clientY: 30 });
        app.endCableDrag(nextOutput);

        expect(remove).toHaveBeenCalledWith(cable);
        expect(add).toHaveBeenCalledWith(nextOutput, toEl, expect.objectContaining({ color: '#ff4a0a' }));
    });
});
