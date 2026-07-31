import { afterEach, describe, expect, it, vi } from 'vitest';
import cvRecorder from '../../src/js/modules/cv-rec/index.js';
import { cleanupRenderedModule, renderModule } from '../../src/js/ui/renderer.js';

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('CV Recorder renderer', () => {
    it('renders exact controls and ports, forwards changes, and cleans up animation/actions', () => {
        vi.useFakeTimers();
        let animationFrame = null;
        const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
            animationFrame = callback;
            return 73;
        });
        const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const onParamChange = vi.fn();
        const dsp = cvRecorder.createDSP({ sampleRate: 48000, bufferSize: 16 });
        const panel = renderModule(cvRecorder, 'cv_rec_1', { dsp, onParamChange });
        document.body.appendChild(panel);

        expect(panel.querySelectorAll('.switch')).toHaveLength(3);
        expect(panel.querySelectorAll('.action-btn')).toHaveLength(4);
        expect(panel.querySelectorAll('.jack.input')).toHaveLength(7);
        expect(panel.querySelectorAll('.jack.output')).toHaveLength(5);
        expect(panel.querySelectorAll('.led')).toHaveLength(8);
        expect(panel.textContent).toContain('RUNTIME · MOD ONLY');

        panel.querySelector('.switch[data-param="mode"]').click();
        expect(onParamChange).toHaveBeenCalledWith('cv_rec_1', 'mode', 1);

        panel.querySelector('.action-btn[data-param="record"]').click();
        expect(onParamChange).toHaveBeenCalledWith('cv_rec_1', 'record', 1);

        dsp.transportState = 3;
        dsp.recordedMode = 0;
        dsp.recordedLength = 12345;
        animationFrame?.(0);
        expect(panel.querySelector('.cv-rec-display').textContent).toBe('PLAY F 12.345s');

        cleanupRenderedModule(panel);
        expect(onParamChange).toHaveBeenCalledWith('cv_rec_1', 'record', 0);
        expect(cancelFrame).toHaveBeenCalledWith(73);
        vi.advanceTimersByTime(100);
        expect(requestFrame).toHaveBeenCalled();
    });
});
