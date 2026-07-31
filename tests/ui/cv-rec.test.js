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
        expect(panel.textContent).toContain('RUNTIME MEMORY · CLOCK REC / STOP: NEXT CLOCK');
        expect(panel.querySelector('[data-param="record"]').textContent).toBe('REC / STOP');
        expect(panel.querySelector('[data-param="play"]').textContent).toBe('PLAY / PAUSE');
        expect(panel.querySelector('[data-param="record"]')).toHaveProperty('title', expect.stringMatching(/REC \/ STOP · READY/));
        expect(panel.querySelector('[data-param="record"]').dataset.state).toBe('ready');
        expect(panel.querySelector('[data-param="play"]')).toHaveProperty('title', expect.stringMatching(/PLAY \/ PAUSE · NO RECORDING/));
        expect(panel.querySelector('[data-param="play"]').dataset.state).toBe('unavailable');
        expect(panel.querySelector('[data-param="resetAction"]').dataset.state).toBe('unavailable');
        expect(panel.querySelector('[data-param="clear"]').dataset.state).toBe('unavailable');

        ['mode', 'shape', 'playMode'].forEach(param => {
            panel.querySelector(`.switch[data-param="${param}"]`).click();
            expect(onParamChange).toHaveBeenCalledWith('cv_rec_1', param, expect.any(Number));
        });

        ['record', 'play', 'resetAction', 'clear'].forEach(param => {
            panel.querySelector(`.action-btn[data-param="${param}"]`).click();
            expect(onParamChange).toHaveBeenCalledWith('cv_rec_1', param, 1);
        });

        dsp.transportState = 3;
        dsp.recordedMode = 0;
        dsp.recordedLength = 12345;
        animationFrame?.(0);
        expect(panel.querySelector('.cv-rec-display').textContent).toBe('PLAY F 12.345s');
        expect(panel.querySelector('[data-param="record"]').classList.contains('active')).toBe(false);
        expect(panel.querySelector('[data-param="play"]').classList.contains('active')).toBe(true);
        expect(panel.querySelector('[data-param="play"]').dataset.state).toBe('playing');
        expect(panel.querySelector('[data-param="play"]')).toHaveProperty('title', expect.stringMatching(/PLAY \/ PAUSE · PLAYING/));

        dsp.transportState = 1;
        dsp.recordArmState = 2;
        dsp.recordedMode = 1;
        dsp.recordedLength = 8;
        animationFrame?.(1);
        expect(panel.querySelector('.cv-rec-display').textContent).toBe('ARM STOP C 0008');
        expect(panel.querySelector('[data-param="record"]').classList.contains('active')).toBe(true);
        expect(panel.querySelector('[data-param="record"]').classList.contains('is-pending')).toBe(true);
        expect(panel.querySelector('[data-param="record"]').dataset.state).toBe('armed-stop');
        expect(panel.querySelector('[data-param="record"]')).toHaveProperty('title', expect.stringMatching(/STOP \/ CANCEL · ARMED STOP/));
        expect(panel.querySelector('[data-param="play"]').classList.contains('active')).toBe(false);
        expect(panel.querySelector('[data-param="play"]').dataset.state).toBe('locked');

        dsp.transportState = 4;
        dsp.recordArmState = 0;
        animationFrame?.(2);
        expect(panel.querySelector('[data-param="record"]').classList.contains('active')).toBe(false);
        expect(panel.querySelector('[data-param="play"]').classList.contains('active')).toBe(false);
        expect(panel.querySelector('[data-param="play"]').dataset.state).toBe('paused');
        expect(panel.querySelector('[data-param="play"]')).toHaveProperty('title', expect.stringMatching(/PLAY \/ PAUSE · PAUSED/));

        cleanupRenderedModule(panel);
        ['record', 'play', 'resetAction', 'clear'].forEach(param => {
            expect(onParamChange).toHaveBeenCalledWith('cv_rec_1', param, 0);
        });
        expect(cancelFrame).toHaveBeenCalledWith(73);
        vi.advanceTimersByTime(100);
        expect(requestFrame).toHaveBeenCalled();
    });
});
