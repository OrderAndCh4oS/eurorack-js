import { describe, it, expect, vi } from 'vitest';
import { renderModule } from '../../src/js/ui/renderer.js';
import { EurorackApp } from '../../src/js/app/app.js';
import loopModule from '../../src/js/modules/loop/index.js';

describe('renderModule', () => {
    it('adds module color token classes to rendered panels', () => {
        const panel = renderModule({
            id: 'visual',
            name: 'VIS',
            hp: 4,
            color: 'module-color-four',
            createDSP: () => ({}),
            ui: {}
        }, 'visual_1', {
            dsp: null,
            onParamChange: vi.fn()
        });

        expect(panel.classList.contains('module-color-four')).toBe(true);
        expect(panel.style.getPropertyValue('--module-color')).toBe('');
        expect(panel.style.getPropertyValue('--factory-module-bg')).toBe('');
        expect(panel.style.background).toBe('');
    });

    it('keeps raw hex module colors as a compatibility fallback', () => {
        const panel = renderModule({
            id: 'visual',
            name: 'VIS',
            hp: 4,
            color: '#222222',
            createDSP: () => ({}),
            ui: {}
        }, 'visual_1', {
            dsp: null,
            onParamChange: vi.fn()
        });

        expect(panel.classList.contains('module-color-four')).toBe(false);
        expect(panel.style.getPropertyValue('--module-color')).toBe('#222222');
        expect(panel.style.getPropertyValue('--module-color-dark')).toBe('#040404');
        expect(panel.style.getPropertyValue('--factory-module-bg')).toBe('#222222');
        expect(panel.style.getPropertyValue('--factory-module-header')).toBe('#343434');
        expect(panel.style.getPropertyValue('--factory-module-dark-bg')).toBe('#040404');
        expect(panel.style.getPropertyValue('--factory-module-dark-header')).toBe('#222222');
    });

    it('passes getModule to custom render functions', () => {
        const getModule = vi.fn(() => ({ instance: { params: {} } }));
        const customRender = vi.fn();

        renderModule({
            id: 'visual',
            name: 'VIS',
            hp: 4,
            color: '#222',
            createDSP: () => ({}),
            render: customRender
        }, 'visual_1', {
            dsp: null,
            getModule,
            onParamChange: vi.fn()
        });

        const context = customRender.mock.calls[0][1];
        expect(context.instance.getModule).toBe(getModule);
        expect(context.instance.getModule()).toEqual({ instance: { params: {} } });
    });

    it('wires custom-render toolkit knobs to onParamChange by default', () => {
        const onParamChange = vi.fn();

        const panel = renderModule({
            id: 'custom',
            name: 'CUSTOM',
            hp: 4,
            color: '#222',
            createDSP: () => ({}),
            render(container, { toolkit }) {
                container.appendChild(toolkit.createKnob({
                    id: 'step1',
                    label: '1',
                    param: 'step1',
                    value: 0,
                    min: 0,
                    max: 1
                }));
            }
        }, 'custom_1', {
            dsp: { params: { step1: 0 } },
            onParamChange
        });

        const knob = panel.querySelector('.knob');
        knob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }));
        document.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }));
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        expect(onParamChange).toHaveBeenCalledWith('custom_1', 'step1', expect.any(Number));
    });

    it('handles custom-render manual toggle buttons like SEQ gates', () => {
        const app = new EurorackApp(document);
        app.setParam = vi.fn();

        const btn = document.createElement('button');
        btn.className = 'toggle-btn active';
        btn.dataset.module = 'seq_1';
        btn.dataset.param = 'gate1';
        document.body.appendChild(btn);

        const preventDefault = vi.fn();

        app.handleClick({ target: btn, preventDefault });

        expect(btn.classList.contains('active')).toBe(false);
        expect(preventDefault).toHaveBeenCalled();
        expect(app.setParam).toHaveBeenCalledWith('seq_1', 'gate1', 0);
        btn.remove();
    });

    it('marks LOOP clear button as renderer-managed', () => {
        const panel = renderModule(loopModule, 'loop_1', {
            dsp: loopModule.createDSP({ sampleRate: 100, bufferSize: 4 }),
            onParamChange: vi.fn()
        });

        const clearButton = panel.querySelector('.loop-clear');
        expect(clearButton).toBeTruthy();
        expect(clearButton.dataset.rendererManaged).toBe('true');
    });

    it('renders LOOP I/O with common section and jack row classes', () => {
        const panel = renderModule(loopModule, 'loop_1', {
            dsp: loopModule.createDSP({ sampleRate: 100, bufferSize: 4 }),
            onParamChange: vi.fn()
        });

        const sections = [...panel.querySelectorAll('.section-label')].map(el => el.textContent);
        const jackRows = panel.querySelectorAll('.jack-row');

        expect(sections).toEqual(['Out', 'In']);
        expect(jackRows).toHaveLength(2);
        expect(panel.querySelector('.loop-jacks')).toBeNull();
        expect(panel.querySelector('.loop-section-label')).toBeNull();
    });

    it('adds titles to LOOP compact buttons', () => {
        const panel = renderModule(loopModule, 'loop_1', {
            dsp: loopModule.createDSP({ sampleRate: 100, bufferSize: 4 }),
            onParamChange: vi.fn()
        });

        const modeTitles = [...panel.querySelectorAll('.loop-mode .octave-btn')].map(btn => btn.title);
        const recordButton = panel.querySelector('.loop-record-button');
        const clearButton = panel.querySelector('.loop-clear');

        expect(modeTitles).toEqual([
            'Sound on Sound',
            'Dub Overdub',
            'Replace Recording',
            'Infinite Overdub'
        ]);
        expect(recordButton.title).toBe('Record Loop');
        expect(clearButton.title).toBe('Clear Loop');
    });

    it('renders LOOP record as a renderer-managed REC-style button', () => {
        const onParamChange = vi.fn();
        const dsp = loopModule.createDSP({ sampleRate: 100, bufferSize: 4 });
        const panel = renderModule(loopModule, 'loop_1', {
            dsp,
            onParamChange
        });

        const recordButton = panel.querySelector('.loop-record-button');

        expect(recordButton).toBeTruthy();
        expect(recordButton.dataset.rendererManaged).toBe('true');
        expect(recordButton.querySelector('.loop-record-button-inner')).toBeTruthy();

        recordButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(recordButton.classList.contains('recording')).toBe(true);
        expect(dsp.params.record).toBe(1);
        expect(onParamChange).toHaveBeenCalledWith('loop_1', 'record', 1);
    });

    it('toggles LOOP record button from DOM state when rendered before DSP exists', () => {
        const onParamChange = vi.fn();
        const panel = renderModule(loopModule, 'loop_1', {
            dsp: null,
            onParamChange
        });

        const recordButton = panel.querySelector('.loop-record-button');

        recordButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        recordButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(recordButton.classList.contains('recording')).toBe(false);
        expect(onParamChange).toHaveBeenNthCalledWith(1, 'loop_1', 'record', 1);
        expect(onParamChange).toHaveBeenNthCalledWith(2, 'loop_1', 'record', 0);
    });

    it('syncs LOOP record button off when DSP auto-stops recording', () => {
        let frameCallback;
        const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
            frameCallback = callback;
            return 1;
        });
        const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const onParamChange = vi.fn((moduleId, param, value) => {
            moduleState.params[param] = value;
        });
        const dsp = loopModule.createDSP({ sampleRate: 100, bufferSize: 4 });
        dsp.params.record = 1;
        const moduleState = { instance: dsp, params: { record: 1 } };

        const panel = renderModule(loopModule, 'loop_1', {
            dsp,
            getModule: () => moduleState,
            onParamChange
        });
        const recordButton = panel.querySelector('.loop-record-button');

        expect(recordButton.classList.contains('recording')).toBe(true);

        dsp.params.record = 0;
        frameCallback();

        expect(recordButton.classList.contains('recording')).toBe(false);
        expect(onParamChange).toHaveBeenCalledWith('loop_1', 'record', 0);

        requestFrame.mockRestore();
        cancelFrame.mockRestore();
    });
});
