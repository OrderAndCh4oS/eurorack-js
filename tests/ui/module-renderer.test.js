import { describe, it, expect, beforeEach } from 'vitest';
import { renderModule, updateKnobRotation } from '../../src/js/ui/module-renderer.js';

describe('module-renderer', () => {
    describe('renderModule', () => {
        const simpleDef = {
            name: 'TEST',
            hp: 4,
            color: '#333333',
            knobs: [
                { id: 'knob1', label: 'K1', param: 'param1', min: 0, max: 1, default: 0.5 }
            ],
            inputs: [
                { id: 'in1', label: 'In', input: 'input1', type: 'cv' }
            ],
            outputs: [
                { id: 'out1', label: 'Out', output: 'output1', type: 'buffer' }
            ]
        };

        it('should create a module element', () => {
            const el = renderModule('test', 'test1', simpleDef);
            expect(el).toBeInstanceOf(HTMLElement);
            expect(el.tagName).toBe('DIV');
        });

        it('should set correct class names', () => {
            const el = renderModule('test', 'test1', simpleDef);
            expect(el.classList.contains('module')).toBe(true);
            expect(el.classList.contains('module-4hp')).toBe(true);
        });

        it('should set correct ID', () => {
            const el = renderModule('test', 'mymod', simpleDef);
            expect(el.id).toBe('module-mymod');
        });

        it('should set background gradient', () => {
            const el = renderModule('test', 'test1', simpleDef);
            expect(el.style.background).toContain('linear-gradient');
        });

        it('should render module name', () => {
            const el = renderModule('test', 'test1', simpleDef);
            expect(el.innerHTML).toContain('TEST');
        });

        it('should render knobs', () => {
            const el = renderModule('test', 'test1', simpleDef);
            const knob = el.querySelector('#knob-test1-knob1');
            expect(knob).not.toBeNull();
            expect(knob.dataset.param).toBe('param1');
            expect(knob.dataset.min).toBe('0');
            expect(knob.dataset.max).toBe('1');
            expect(knob.dataset.value).toBe('0.5');
        });

        it('should render inputs', () => {
            const el = renderModule('test', 'test1', simpleDef);
            const input = el.querySelector('#jack-test1-in1');
            expect(input).not.toBeNull();
            expect(input.dataset.dir).toBe('input');
            expect(input.dataset.port).toBe('input1');
        });

        it('should render outputs', () => {
            const el = renderModule('test', 'test1', simpleDef);
            const output = el.querySelector('#jack-test1-out1');
            expect(output).not.toBeNull();
            expect(output.dataset.dir).toBe('output');
            expect(output.dataset.port).toBe('output1');
        });

        it('should render LEDs when defined', () => {
            const defWithLeds = { ...simpleDef, leds: ['led1', 'led2'] };
            const el = renderModule('test', 'test1', defWithLeds);

            const led1 = el.querySelector('#led-test1-led1');
            const led2 = el.querySelector('#led-test1-led2');
            expect(led1).not.toBeNull();
            expect(led2).not.toBeNull();
        });

        it('should render switches when defined', () => {
            const defWithSwitches = {
                ...simpleDef,
                switches: [
                    { id: 'sw1', label: 'Sw', param: 'switch1', default: true }
                ]
            };
            const el = renderModule('test', 'test1', defWithSwitches);

            const sw = el.querySelector('#switch-test1-sw1');
            expect(sw).not.toBeNull();
            expect(sw.classList.contains('on')).toBe(true);
        });

        it('should render button banks when defined', () => {
            const defWithButtons = {
                ...simpleDef,
                buttons: [
                    { id: 'btn', label: 'Oct', param: 'octave', values: [-1, 0, 1], default: 0 }
                ]
            };
            const el = renderModule('test', 'test1', defWithButtons);

            const buttons = el.querySelectorAll('.octave-btn');
            expect(buttons.length).toBe(3);

            const activeBtn = el.querySelector('.octave-btn.active');
            expect(activeBtn.dataset.value).toBe('0');
        });

        it('should group inputs for large modules', () => {
            const defWithManyInputs = {
                ...simpleDef,
                inputs: [
                    { id: 'cv0', label: 'CV1', input: 'cv[0]', type: 'buffer' },
                    { id: 'cv1', label: 'CV2', input: 'cv[1]', type: 'buffer' },
                    { id: 'cv2', label: 'CV3', input: 'cv[2]', type: 'buffer' },
                    { id: 'cv3', label: 'CV4', input: 'cv[3]', type: 'buffer' },
                    { id: 'trig0', label: 'T1', input: 'trig[0]', type: 'cv' }
                ]
            };
            const el = renderModule('test', 'test1', defWithManyInputs);

            // Should have grouped sections
            expect(el.innerHTML).toContain('CV In');
            expect(el.innerHTML).toContain('Trig In');
        });
    });

    describe('updateKnobRotation', () => {
        it('should set transform rotation', () => {
            const knob = document.createElement('div');
            knob.dataset.min = '0';
            knob.dataset.max = '1';
            knob.dataset.value = '0.5';

            updateKnobRotation(knob);

            expect(knob.style.transform).toContain('rotate');
        });

        it('should rotate to -135deg at min value', () => {
            const knob = document.createElement('div');
            knob.dataset.min = '0';
            knob.dataset.max = '1';
            knob.dataset.value = '0';

            updateKnobRotation(knob);

            expect(knob.style.transform).toBe('rotate(-135deg)');
        });

        it('should rotate to 135deg at max value', () => {
            const knob = document.createElement('div');
            knob.dataset.min = '0';
            knob.dataset.max = '1';
            knob.dataset.value = '1';

            updateKnobRotation(knob);

            expect(knob.style.transform).toBe('rotate(135deg)');
        });

        it('should rotate to 0deg at midpoint', () => {
            const knob = document.createElement('div');
            knob.dataset.min = '0';
            knob.dataset.max = '1';
            knob.dataset.value = '0.5';

            updateKnobRotation(knob);

            expect(knob.style.transform).toBe('rotate(0deg)');
        });
    });
});
