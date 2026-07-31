import { afterEach, describe, expect, it, vi } from 'vitest';
import probSeqModule from '../../src/js/modules/prob-seq/index.js';
import { cleanupRenderedModule, renderModule } from '../../src/js/ui/renderer.js';

afterEach(() => {
    vi.restoreAllMocks();
});

function renderProbSeq() {
    const dsp = probSeqModule.createDSP({ sampleRate: 1000, bufferSize: 8 });
    dsp.process();
    const onParamChange = vi.fn();
    const panel = renderModule(probSeqModule, 'prob_seq_1', { dsp, onParamChange });
    return { dsp, onParamChange, panel };
}

function dragKnob(knob, startY, endY) {
    knob.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientY: startY }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: endY }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientY: endY }));
}

describe('PROB SEQ custom renderer', () => {
    it('shows all step summaries, the selected editor, status, and exact ports', () => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const { panel } = renderProbSeq();

        expect(panel.classList.contains('module-14hp')).toBe(true);
        expect(panel.querySelectorAll('.prob-seq-step')).toHaveLength(8);
        expect(panel.querySelector('.prob-seq-editor strong').textContent).toBe('STEP 1');
        expect([...panel.querySelectorAll('.prob-seq-top-row .knob')].map(control => control.dataset.param))
            .toEqual(['seed', 'length', 'fallbackBpm']);
        expect([...panel.querySelectorAll('.prob-seq-editor-knob .knob')]
            .map(control => control.id))
            .toEqual(['knob-prob_seq_1-stepProbability', 'knob-prob_seq_1-stepRatchets']);
        expect(panel.querySelectorAll('.prob-seq-editor-knob .knob[data-param]')).toHaveLength(0);
        expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(0);
        expect(panel.querySelectorAll('.hardware-button')).toHaveLength(9);
        expect(panel.querySelector('.hardware-select')).toBeTruthy();
        expect([...panel.querySelectorAll('.led')].map(led => led.dataset.led))
            .toEqual(['hit', 'miss', 'eoc', 'pending']);
        expect([...panel.querySelectorAll('.jack')].map(jack => [
            jack.dataset.port,
            jack.dataset.dir,
            jack.dataset.signal
        ])).toEqual([
            ['clock', 'input', 'trigger'],
            ['reset', 'input', 'trigger'],
            ['fill', 'input', 'gate'],
            ['probabilityCv', 'input', 'cv'],
            ['gate', 'output', 'trigger'],
            ['eoc', 'output', 'trigger']
        ]);

        cleanupRenderedModule(panel);
    });

    it('replaces structured steps immutably and routes every editor gesture through onParamChange', () => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const { dsp, onParamChange, panel } = renderProbSeq();
        const originalSteps = dsp.params.steps;
        const originalSecond = originalSteps[1];

        panel.querySelector('.prob-seq-step[data-step="1"]').click();
        const probability = panel.querySelector('.prob-seq-editor-knob[data-field="probability"] .knob');
        dragKnob(probability, 100, 194.5);

        expect(originalSteps[1].probability).toBe(100);
        expect(dsp.params.steps).not.toBe(originalSteps);
        expect(dsp.params.steps[1]).not.toBe(originalSecond);
        expect(dsp.params.steps[1].probability).toBe(37);
        expect(onParamChange).toHaveBeenLastCalledWith(
            'prob_seq_1',
            'steps',
            expect.arrayContaining([expect.objectContaining({ probability: 37 })])
        );

        const ratchets = panel.querySelector('.prob-seq-editor-knob[data-field="ratchets"] .knob');
        dragKnob(ratchets, 100, 14.3);
        const condition = panel.querySelector('[data-field="condition"]');
        condition.value = '9';
        condition.dispatchEvent(new Event('change', { bubbles: true }));
        panel.querySelector('.prob-seq-enable').click();

        expect(dsp.params.steps[1]).toEqual({
            enabled: 0,
            probability: 37,
            ratchets: 5,
            condition: 9
        });
        expect(onParamChange).toHaveBeenCalledTimes(4);
        expect(panel.querySelector('.prob-seq-step[data-step="1"]').textContent)
            .toContain('SKIP');
        expect(panel.querySelector('[data-field="probabilityValue"]').value).toBe('37%');
        expect(panel.querySelector('[data-field="ratchetsValue"]').value).toBe('×5');

        cleanupRenderedModule(panel);
    });

    it('polls bounded telemetry and notices externally replaced structured state', () => {
        let frameCallback;
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
            frameCallback = callback;
            return 11;
        });
        const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const { dsp, panel } = renderProbSeq();

        dsp.activeSeed = 42;
        dsp.activeLength = 3;
        dsp.cycleNumber = 4;
        dsp.leds.step1 = 0;
        dsp.leds.step3 = 1;
        dsp.params.steps = dsp.params.steps.map((step, index) => ({
            ...step,
            probability: index === 0 ? 12 : step.probability
        }));
        frameCallback();

        expect(panel.querySelector('[data-field="activeSeed"]').textContent)
            .toBe('ACTIVE 00042');
        expect(panel.querySelector('[data-field="activeLength"]').textContent)
            .toBe('LEN 3');
        expect(panel.querySelector('[data-field="cycleNumber"]').textContent)
            .toBe('CYCLE 4');
        expect(panel.querySelector('.prob-seq-step[data-step="2"]').classList.contains('playing'))
            .toBe(true);
        expect(panel.querySelector('.prob-seq-step[data-step="3"]').classList.contains('inactive'))
            .toBe(true);
        expect(panel.querySelector('.prob-seq-step[data-step="0"]').textContent)
            .toContain('12%');
        expect(panel.querySelector('[data-field="probabilityValue"]').value).toBe('12%');

        cleanupRenderedModule(panel);
        expect(cancelFrame).toHaveBeenCalledWith(11);
    });
});
