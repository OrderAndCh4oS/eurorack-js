import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RackDebugger } from '../../src/js/ui/rack-debugger.js';

let controller;
let frames;
let nextFrame;

beforeEach(() => {
    document.body.innerHTML = `<button id="rackDebuggerToggle" aria-expanded="false" aria-pressed="false">Debug</button>
        <main id="rackView"><div id="rack-container"></div></main>`;
    frames = new Map();
    nextFrame = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
        frames.set(++nextFrame, callback);
        return nextFrame;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => frames.delete(id));
});

afterEach(() => {
    controller?.dispose();
    controller = null;
    vi.restoreAllMocks();
});

function fixture() {
    const patch = { version: 3, plugins: { core: 1 }, modules: [], params: {}, cables: [], midiMappings: {} };
    const states = new Map();
    const listeners = new Set();
    let report = { moduleCount: 0, cableCount: 0, issues: [] };
    const analyse = vi.fn(() => report);
    const app = {
        rackContainer: document.getElementById('rack-container'),
        host: {
            serializePatch: vi.fn(() => structuredClone(patch)),
            subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }
        },
        state: { getModule: id => states.get(id) },
        renderAllCables: vi.fn()
    };
    const registry = { get: type => ({ name: type.toUpperCase() }) };
    controller = new RackDebugger({ app, document, registry, analyse }).init();
    const add = (id = 'osc', attributes = {}) => {
        const panel = document.createElement('section');
        panel.className = 'module';
        panel.dataset.instanceId = id;
        Object.entries(attributes).forEach(([name, value]) => panel.setAttribute(name, value));
        app.rackContainer.append(panel);
        patch.modules.push({ id, type: 'vco', row: 1, index: patch.modules.length });
        states.set(id, { element: panel });
        return panel;
    };
    return {
        app, patch, add, analyse, listeners,
        report: next => { report = next; },
        emit: type => listeners.forEach(listener => listener({ type })),
        flush: () => {
            const callbacks = [...frames.values()];
            frames.clear();
            callbacks.forEach(callback => callback());
        }
    };
}

function findings(...moduleIds) {
    return { moduleCount: moduleIds.length, cableCount: 0, issues: moduleIds.map(id => ({
        code: 'module-unconnected', severity: 'warning', message: 'No cables connected.', moduleIds: [id]
    })) };
}

describe('RackDebugger', () => {
    it('stays off until requested, then highlights without changing the patch', () => {
        const f = fixture();
        const module = f.add();
        f.report(findings('osc'));
        const before = structuredClone(f.patch);
        f.emit('cables-changed');
        expect(f.analyse).not.toHaveBeenCalled();
        expect(frames.size).toBe(0);
        expect(controller.panel.hidden).toBe(true);

        controller.toggleButton.click();
        expect(controller.panel.hidden).toBe(false);
        expect(controller.toggleButton.getAttribute('aria-pressed')).toBe('true');
        expect(controller.summary.textContent).toBe('1 thing to check');
        expect(module.classList.contains('rack-debugger-flagged')).toBe(true);
        expect(module.querySelector('.rack-debugger-marker').textContent).toBe('1');
        expect(f.patch).toEqual(before);

        controller.toggleButton.click();
        expect(module.classList.contains('rack-debugger-flagged')).toBe(false);
        expect(module.querySelector('.rack-debugger-marker')).toBeNull();
        expect(module.hasAttribute('aria-describedby')).toBe(false);
        expect(module.hasAttribute('tabindex')).toBe(false);
        expect(f.patch).toEqual(before);
    });

    it('coalesces topology changes until the app has rendered and ignores knob changes', () => {
        const f = fixture();
        controller.toggle(true);
        f.analyse.mockClear();
        f.emit('param-changed');
        expect(frames.size).toBe(0);
        f.emit('module-added');
        f.emit('cables-changed');
        f.emit('registry');
        expect(frames.size).toBe(1);
        const module = f.add();
        f.report(findings('osc'));
        expect(f.analyse).not.toHaveBeenCalled();
        f.flush();
        expect(f.analyse).toHaveBeenCalledOnce();
        expect(module.classList.contains('rack-debugger-flagged')).toBe(true);

        f.report({ moduleCount: 1, cableCount: 1, issues: [] });
        f.emit('cables-changed');
        f.flush();
        expect(controller.summary.textContent).toBe('No connection issues found.');
        expect(module.classList.contains('rack-debugger-flagged')).toBe(false);
    });

    it('focuses a finding in the rack and preserves existing accessibility attributes', () => {
        const f = fixture();
        const module = f.add('osc', { tabindex: '0', 'aria-describedby': 'existing-help' });
        module.scrollIntoView = vi.fn();
        f.report(findings('osc'));
        controller.toggle(true);
        controller.list.querySelector('button').click();
        expect(document.activeElement).toBe(module);
        expect(module.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
        expect(module.getAttribute('aria-describedby')).toContain('existing-help rack-debugger-issue-0');
        module.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(controller.enabled).toBe(false);
        expect(document.activeElement).toBe(controller.toggleButton);
        expect(module.getAttribute('aria-describedby')).toBe('existing-help');
        expect(module.getAttribute('tabindex')).toBe('0');
    });

    it('removes stale markers and keeps list focus when a module is removed', () => {
        const f = fixture();
        const first = f.add('first');
        f.add('second');
        f.report(findings('first', 'second'));
        controller.toggle(true);
        controller.list.querySelectorAll('button')[1].focus();
        first.remove();
        f.report(findings('second'));
        f.emit('module-removed');
        f.flush();
        expect(controller.highlights.size).toBe(1);
        expect(document.activeElement.textContent).toContain('second');
        expect(first.querySelector('.rack-debugger-marker')).toBeNull();

        f.report({ moduleCount: 0, cableCount: 0, issues: [] });
        f.emit('patch-loaded');
        f.flush();
        expect(controller.highlights.size).toBe(0);
        expect(document.activeElement).toBe(controller.summary);
    });

    it('renders global advisories and untrusted module labels as text', () => {
        const f = fixture();
        f.add('<img src=x onerror=alert(1)>');
        f.report({ moduleCount: 1, cableCount: 0, issues: [
            { code: 'missing-output', severity: 'info', message: 'No OUT module.', moduleIds: [] },
            { code: 'module-unconnected', severity: 'warning', message: '<script>bad()</script>', moduleIds: ['<img src=x onerror=alert(1)>'] }
        ] });
        controller.toggle(true);
        expect(controller.list.querySelectorAll('button')).toHaveLength(1);
        expect(controller.list.querySelectorAll('img, script')).toHaveLength(0);
        expect(controller.list.textContent).toContain('<script>bad()</script>');
        expect(controller.list.textContent).toContain('No OUT module.');
    });

    it('cancels pending work and unsubscribes when disposed', () => {
        const f = fixture();
        f.add();
        f.report(findings('osc'));
        controller.toggle(true);
        f.emit('patch-loaded');
        expect(frames.size).toBe(1);
        controller.dispose();
        expect(frames.size).toBe(0);
        expect(f.listeners.size).toBe(0);
        expect(document.querySelector('#rack-debugger')).toBeNull();
        expect(document.querySelector('.rack-debugger-marker')).toBeNull();
        expect(controller.toggleButton.getAttribute('aria-expanded')).toBe('false');
        controller.toggleButton.click();
        expect(controller.enabled).toBe(false);
    });
});
