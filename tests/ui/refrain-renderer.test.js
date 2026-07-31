import { afterEach, describe, expect, it, vi } from 'vitest';
import refrainModule from '../../src/js/modules/refrain/index.js';
import {
    cleanupRenderedModule,
    renderModule,
    syncParamToModuleUI
} from '../../src/js/ui/renderer.js';

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function renderRefrain({ dsp = refrainModule.createDSP({ sampleRate: 1000, bufferSize: 8 }) } = {}) {
    const onParamChange = vi.fn();
    const panel = renderModule(refrainModule, 'refrain_1', {
        dsp,
        onParamChange
    });
    return { dsp, onParamChange, panel };
}

describe('REFRAIN custom renderer', () => {
    it('renders the complete compact 12HP contract with toolkit-addressable controls and jacks', () => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const { panel } = renderRefrain();

        expect(panel.classList.contains('module-12hp')).toBe(true);
        expect(panel.querySelector('.refrain-panel')).toBeTruthy();
        expect(panel.querySelector('[data-seed-field="active"]').textContent).toBe('00000');
        expect(panel.querySelector('[data-seed-field="next"]').textContent).toBe('—');

        expect([...panel.querySelectorAll('.knob')].map(knob => knob.dataset.param)).toEqual([
            'seed',
            'length',
            'amount',
            'chance'
        ]);
        expect([...panel.querySelectorAll('.refrain-lane-toggle')].map(button => (
            button.dataset.param
        ))).toEqual([
            'mutateKey',
            'mutateHarm',
            'mutateEnergy',
            'mutateMod'
        ]);
        expect([...panel.querySelectorAll('.refrain-lane-toggle')].map(button => (
            button.title
        ))).toEqual([
            'KEY · ON — Mutate may change the tonal center and pitch-offset sequence. Click to turn OFF.',
            'HARM · ON — Mutate may change the chord and harmonic-selector sequence. Click to turn OFF.',
            'ENERGY · ON — Mutate may change the rhythmic-density and accent sequence. Click to turn OFF.',
            'MOD · ON — Mutate may change the general-purpose timbre and motion sequence. Click to turn OFF.'
        ]);
        expect([...panel.querySelectorAll('.action-trigger')].map(button => (
            button.dataset.param
        ))).toEqual(['mutate', 'recall']);
        expect(panel.querySelector('[data-param="mutate"]').title).toMatch(/MUTATE · READY/);
        expect(panel.querySelector('[data-param="recall"]').title).toMatch(/RECALL · NO ANCHOR/);
        expect(panel.querySelector('.switch[data-param="anchor"]')).toBeTruthy();
        expect(panel.querySelector('.refrain-action-row .knob-container').title)
            .toMatch(/RUN \/ HOLD · RUN/);

        expect([...panel.querySelectorAll('.jack')].map(jack => [
            jack.dataset.port,
            jack.dataset.dir,
            jack.dataset.signal
        ])).toEqual([
            ['key', 'output', 'cv'],
            ['harm', 'output', 'cv'],
            ['energy', 'output', 'cv'],
            ['mod', 'output', 'cv'],
            ['clock', 'input', 'trigger'],
            ['reset', 'input', 'trigger'],
            ['seedCV', 'input', 'cv'],
            ['mutateTrig', 'input', 'trigger'],
            ['recallTrig', 'input', 'trigger'],
            ['hold', 'input', 'gate']
        ]);
        expect([...panel.querySelectorAll('.led')].map(led => led.dataset.led)).toEqual([
            'cell1',
            'cell2',
            'cell3',
            'cell4',
            'cell5',
            'cell6',
            'cell7',
            'cell8',
            'substep',
            'anchor',
            'pending',
            'seedPending',
            'mutation'
        ]);
        expect(panel.querySelector('.refrain-note').title).toMatch(/volatile/i);
        expect(panel.querySelector('.refrain-note').title).toMatch(/destination knob/i);

        cleanupRenderedModule(panel);
    });

    it('routes lane, Hold, Mutate, Recall, and knob gestures through onParamChange', () => {
        vi.useFakeTimers();
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const { onParamChange, panel } = renderRefrain();

        panel.querySelector('[data-param="mutateKey"]').click();
        expect(panel.querySelector('[data-param="mutateKey"]').title)
            .toBe('KEY · OFF — Mutate will preserve the tonal center and pitch-offset sequence. Click to turn ON.');
        panel.querySelector('.switch[data-param="anchor"]').click();
        panel.querySelector('[data-param="mutate"]').click();
        panel.querySelector('[data-param="recall"]').click();

        const seed = panel.querySelector('.knob[data-param="seed"]');
        seed.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }));
        document.dispatchEvent(new MouseEvent('mousemove', { clientY: 80, bubbles: true }));
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        expect(onParamChange).toHaveBeenCalledWith('refrain_1', 'mutateKey', 0);
        expect(onParamChange).toHaveBeenCalledWith('refrain_1', 'anchor', 1);
        expect(onParamChange).toHaveBeenCalledWith('refrain_1', 'mutate', 1);
        expect(onParamChange).toHaveBeenCalledWith('refrain_1', 'recall', 1);
        expect(onParamChange).toHaveBeenCalledWith(
            'refrain_1',
            'seed',
            expect.any(Number)
        );

        vi.advanceTimersByTime(100);
        expect(onParamChange).toHaveBeenCalledWith('refrain_1', 'mutate', 0);
        expect(onParamChange).toHaveBeenCalledWith('refrain_1', 'recall', 0);
        cleanupRenderedModule(panel);
    });

    it('synchronizes persisted lane toggles and Hold after patch replacement', () => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const { panel } = renderRefrain();

        syncParamToModuleUI(panel, 'refrain_1', 'mutateHarm', 0);
        syncParamToModuleUI(panel, 'refrain_1', 'anchor', 1);

        expect(
            panel.querySelector('[data-param="mutateHarm"]').classList.contains('active')
        ).toBe(false);
        expect(panel.querySelector('[data-param="mutateHarm"]').title)
            .toBe('HARM · OFF — Mutate will preserve the chord and harmonic-selector sequence. Click to turn ON.');
        expect(
            panel.querySelector('.switch[data-param="anchor"]').classList.contains('on')
        ).toBe(true);
        expect(panel.querySelector('.refrain-action-row .knob-container').title)
            .toMatch(/RUN \/ HOLD · HOLD/);

        syncParamToModuleUI(panel, 'refrain_1', 'mutateHarm', 1);
        expect(panel.querySelector('[data-param="mutateHarm"]').title)
            .toBe('HARM · ON — Mutate may change the chord and harmonic-selector sequence. Click to turn OFF.');
        cleanupRenderedModule(panel);
    });

    it('keeps queued Mutate/Recall actions active and gives every state an explicit title', () => {
        let frameCallback;
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
            frameCallback = callback;
            return 8;
        });
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const { dsp, panel } = renderRefrain();
        const mutate = panel.querySelector('[data-param="mutate"]');
        const recall = panel.querySelector('[data-param="recall"]');

        dsp.pendingActionState = 1;
        frameCallback();
        expect(mutate.classList.contains('active')).toBe(true);
        expect(mutate.classList.contains('is-pending')).toBe(true);
        expect(mutate.dataset.state).toBe('queued');
        expect(mutate.title).toMatch(/MUTATE · QUEUED/);
        expect(recall.dataset.state).toBe('unavailable');

        dsp.leds.anchor = 0.5;
        dsp.pendingActionState = 2;
        frameCallback();
        expect(mutate.classList.contains('active')).toBe(false);
        expect(recall.classList.contains('active')).toBe(true);
        expect(recall.dataset.state).toBe('queued');
        expect(recall.title).toMatch(/RECALL · QUEUED/);

        dsp.pendingActionState = 0;
        frameCallback();
        expect(recall.classList.contains('active')).toBe(false);
        expect(recall.dataset.state).toBe('ready');
        expect(recall.title).toMatch(/RECALL · READY/);
        cleanupRenderedModule(panel);
    });

    it('treats the seed readout as status rather than a module drag handle', () => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const { panel } = renderRefrain();
        const moduleMouseDown = vi.fn();
        panel.addEventListener('mousedown', moduleMouseDown);

        panel.querySelector('.refrain-seed-status').dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, button: 0 })
        );

        expect(moduleMouseDown).not.toHaveBeenCalled();
        expect(panel.querySelector('.refrain-seed-display').title)
            .toMatch(/next cell boundary/i);
        cleanupRenderedModule(panel);
    });

    it('updates ACTIVE/NEXT from bounded scalar telemetry and marks armed versus Held targets', () => {
        let frameCallback;
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
            frameCallback = callback;
            return 7;
        });
        const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const { dsp, panel } = renderRefrain();
        const active = panel.querySelector('[data-seed-field="active"]');
        const next = panel.querySelector('[data-seed-field="next"]');
        const status = panel.querySelector('.refrain-seed-status');

        dsp.activeSeed = 42;
        dsp.nextSeed = 43;
        dsp.seedPendingState = 1;
        frameCallback();
        expect(active.textContent).toBe('00042');
        expect(next.textContent).toBe('00043');
        expect(status.textContent).toBe('PEND');
        expect(status.title).toMatch(/next cell boundary/i);
        expect(status.classList.contains('is-armed')).toBe(true);
        expect(status.classList.contains('is-held')).toBe(false);

        dsp.seedPendingState = 2;
        frameCallback();
        expect(status.classList.contains('is-held')).toBe(true);
        expect(status.dataset.state).toBe('held');

        dsp.activeSeed = 43;
        dsp.nextSeed = 43;
        dsp.seedPendingState = 0;
        frameCallback();
        expect(active.textContent).toBe('00043');
        expect(next.textContent).toBe('—');
        expect(status.dataset.state).toBe('equal');

        cleanupRenderedModule(panel);
        expect(cancelFrame).toHaveBeenCalledWith(7);
    });
});
