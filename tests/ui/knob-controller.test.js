import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    createKnobController,
    setKnobValue,
    getKnobValue
} from '../../src/js/ui/knob-controller.js';

describe('knob-controller', () => {
    describe('createKnobController', () => {
        it('should create a controller', () => {
            const controller = createKnobController();
            expect(controller).toBeDefined();
            expect(typeof controller.startDrag).toBe('function');
            expect(typeof controller.updateDrag).toBe('function');
            expect(typeof controller.endDrag).toBe('function');
        });

        it('should not be dragging initially', () => {
            const controller = createKnobController();
            expect(controller.isDragging()).toBe(false);
        });
    });

    describe('drag operations', () => {
        let controller;
        let knob;
        let onParamChange;

        beforeEach(() => {
            onParamChange = vi.fn();
            controller = createKnobController({ onParamChange });

            knob = document.createElement('div');
            knob.className = 'knob';
            knob.dataset.module = 'test';
            knob.dataset.param = 'volume';
            knob.dataset.min = '0';
            knob.dataset.max = '1';
            knob.dataset.value = '0.5';
            knob.dataset.step = '0';
        });

        it('should start dragging', () => {
            const event = { clientY: 100 };
            controller.startDrag(knob, event);
            expect(controller.isDragging()).toBe(true);
        });

        it('should end dragging', () => {
            controller.startDrag(knob, { clientY: 100 });
            controller.endDrag();
            expect(controller.isDragging()).toBe(false);
        });

        it('should update value on drag up', () => {
            controller.startDrag(knob, { clientY: 100 });
            controller.updateDrag({ clientY: 50 }); // Drag up = increase

            expect(parseFloat(knob.dataset.value)).toBeGreaterThan(0.5);
        });

        it('should update value on drag down', () => {
            controller.startDrag(knob, { clientY: 100 });
            controller.updateDrag({ clientY: 150 }); // Drag down = decrease

            expect(parseFloat(knob.dataset.value)).toBeLessThan(0.5);
        });

        it('should clamp to min value', () => {
            controller.startDrag(knob, { clientY: 100 });
            controller.updateDrag({ clientY: 500 }); // Large drag down

            expect(parseFloat(knob.dataset.value)).toBe(0);
        });

        it('should clamp to max value', () => {
            controller.startDrag(knob, { clientY: 100 });
            controller.updateDrag({ clientY: -400 }); // Large drag up

            expect(parseFloat(knob.dataset.value)).toBe(1);
        });

        it('should call onParamChange callback', () => {
            controller.startDrag(knob, { clientY: 100 });
            controller.updateDrag({ clientY: 50 });

            expect(onParamChange).toHaveBeenCalledWith('test', 'volume', expect.any(Number));
        });

        it('should apply stepping when step > 0', () => {
            knob.dataset.step = '0.1';
            knob.dataset.value = '0.5';

            controller.startDrag(knob, { clientY: 100 });
            controller.updateDrag({ clientY: 90 }); // Small drag up

            const value = parseFloat(knob.dataset.value);
            // Should be snapped to 0.1 increments (use toBeCloseTo for float precision)
            expect(Math.round(value * 10) / 10).toBeCloseTo(value, 10);
        });

        it('should handle touch events', () => {
            const touchEvent = { touches: [{ clientY: 100 }] };
            controller.startDrag(knob, touchEvent);
            expect(controller.isDragging()).toBe(true);

            controller.updateDrag({ touches: [{ clientY: 50 }] });
            expect(parseFloat(knob.dataset.value)).toBeGreaterThan(0.5);
        });
    });

    describe('setKnobValue', () => {
        let knob;

        beforeEach(() => {
            knob = document.createElement('div');
            knob.dataset.min = '0';
            knob.dataset.max = '1';
            knob.dataset.value = '0.5';
        });

        it('should set the knob value', () => {
            setKnobValue(knob, 0.75);
            expect(knob.dataset.value).toBe('0.75');
        });

        it('should clamp to min', () => {
            setKnobValue(knob, -1);
            expect(knob.dataset.value).toBe('0');
        });

        it('should clamp to max', () => {
            setKnobValue(knob, 2);
            expect(knob.dataset.value).toBe('1');
        });

        it('should update rotation style', () => {
            setKnobValue(knob, 1);
            expect(knob.style.transform).toContain('rotate');
        });
    });

    describe('getKnobValue', () => {
        it('should return current value', () => {
            const knob = document.createElement('div');
            knob.dataset.value = '0.75';

            expect(getKnobValue(knob)).toBe(0.75);
        });
    });
});
