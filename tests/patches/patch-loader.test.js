import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    applyKnobs,
    applySwitches,
    applyButtons,
    applyCables,
    applyParams,
    applyPatchState
} from '../../src/js/patches/patch-loader.js';

// Mock updateKnobRotation
vi.mock('../../src/js/ui/toolkit/components.js', () => ({
    updateKnobRotation: vi.fn()
}));

describe('patch-loader', () => {
    describe('applyKnobs', () => {
        let container;
        let modules;

        beforeEach(() => {
            container = document.createElement('div');
            modules = {};
        });

        it('should apply knob values to DOM', () => {
            const knob = document.createElement('div');
            knob.className = 'knob';
            knob.dataset.module = 'vco';
            knob.dataset.param = 'frequency';
            knob.dataset.value = '0';
            container.appendChild(knob);

            applyKnobs({ vco: { frequency: 440 } }, { container });

            expect(knob.dataset.value).toBe('440');
        });

        it('should update module instance params', () => {
            const knob = document.createElement('div');
            knob.className = 'knob';
            knob.dataset.module = 'vco';
            knob.dataset.param = 'frequency';
            container.appendChild(knob);

            modules.vco = { instance: { params: { frequency: 0 } } };

            applyKnobs({ vco: { frequency: 440 } }, { container, modules });

            expect(modules.vco.instance.params.frequency).toBe(440);
        });

        it('should handle missing knob elements gracefully', () => {
            modules.vco = { instance: { params: { frequency: 0 } } };

            // Should not throw
            applyKnobs({ vco: { frequency: 440 } }, { container, modules });
            expect(modules.vco.instance.params.frequency).toBe(440);
        });

        it('should handle null knobs', () => {
            expect(() => applyKnobs(null, { container })).not.toThrow();
        });

        it('should handle undefined knobs', () => {
            expect(() => applyKnobs(undefined, { container })).not.toThrow();
        });
    });

    describe('applySwitches', () => {
        let container;
        let modules;

        beforeEach(() => {
            container = document.createElement('div');
            modules = {};
        });

        it('should apply switch on state', () => {
            const sw = document.createElement('div');
            sw.className = 'switch';
            sw.dataset.module = 'lfo';
            sw.dataset.param = 'sync';
            container.appendChild(sw);

            applySwitches({ lfo: { sync: true } }, { container });

            expect(sw.classList.contains('on')).toBe(true);
        });

        it('should apply switch off state', () => {
            const sw = document.createElement('div');
            sw.className = 'switch on';
            sw.dataset.module = 'lfo';
            sw.dataset.param = 'sync';
            container.appendChild(sw);

            applySwitches({ lfo: { sync: false } }, { container });

            expect(sw.classList.contains('on')).toBe(false);
        });

        it('should update module instance with numeric value', () => {
            const sw = document.createElement('div');
            sw.className = 'switch';
            sw.dataset.module = 'lfo';
            sw.dataset.param = 'sync';
            container.appendChild(sw);

            modules.lfo = { instance: { params: { sync: 0 } } };

            applySwitches({ lfo: { sync: true } }, { container, modules });

            expect(modules.lfo.instance.params.sync).toBe(1);
        });

        it('should handle array params like continuous[0]', () => {
            const sw = document.createElement('div');
            sw.className = 'switch';
            sw.dataset.module = 'seq';
            sw.dataset.param = 'continuous[0]';
            container.appendChild(sw);

            modules.seq = { instance: { params: { continuous: [false, false, false] } } };

            applySwitches({ seq: { 'continuous[0]': true } }, { container, modules });

            expect(modules.seq.instance.params.continuous[0]).toBe(true);
        });

        it('should handle null switches', () => {
            expect(() => applySwitches(null, { container })).not.toThrow();
        });
    });

    describe('applyButtons', () => {
        let container;
        let modules;

        beforeEach(() => {
            container = document.createElement('div');
            modules = {};
        });

        it('should activate correct button', () => {
            const bank = document.createElement('div');
            bank.className = 'button-bank';
            bank.dataset.module = 'vco';
            bank.dataset.param = 'octave';

            const btn1 = document.createElement('button');
            btn1.className = 'octave-btn active';
            btn1.dataset.value = '1';

            const btn2 = document.createElement('button');
            btn2.className = 'octave-btn';
            btn2.dataset.value = '2';

            bank.appendChild(btn1);
            bank.appendChild(btn2);
            container.appendChild(bank);

            applyButtons({ vco: { octave: 2 } }, { container });

            expect(btn1.classList.contains('active')).toBe(false);
            expect(btn2.classList.contains('active')).toBe(true);
        });

        it('should update module instance param', () => {
            const bank = document.createElement('div');
            bank.className = 'button-bank';
            bank.dataset.module = 'vco';
            bank.dataset.param = 'octave';
            container.appendChild(bank);

            modules.vco = { instance: { params: { octave: 0 } } };

            applyButtons({ vco: { octave: 3 } }, { container, modules });

            expect(modules.vco.instance.params.octave).toBe(3);
        });

        it('should handle null buttons', () => {
            expect(() => applyButtons(null, { container })).not.toThrow();
        });
    });

    describe('applyCables', () => {
        let container;

        beforeEach(() => {
            container = document.createElement('div');
        });

        it('should call addCable for each connection', () => {
            const fromJack = document.createElement('div');
            fromJack.className = 'jack';
            fromJack.dataset.module = 'lfo';
            fromJack.dataset.port = 'primary';

            const toJack = document.createElement('div');
            toJack.className = 'jack';
            toJack.dataset.module = 'vco';
            toJack.dataset.port = 'vOct';

            container.appendChild(fromJack);
            container.appendChild(toJack);

            const addCable = vi.fn(() => ({ id: '1' }));

            const cables = [
                { fromModule: 'lfo', fromPort: 'primary', toModule: 'vco', toPort: 'vOct' }
            ];

            const created = applyCables(cables, { container, addCable });

            expect(addCable).toHaveBeenCalledWith(fromJack, toJack);
            expect(created.length).toBe(1);
        });

        it('should skip missing jacks', () => {
            const fromJack = document.createElement('div');
            fromJack.className = 'jack';
            fromJack.dataset.module = 'lfo';
            fromJack.dataset.port = 'primary';
            container.appendChild(fromJack);

            const addCable = vi.fn();

            const cables = [
                { fromModule: 'lfo', fromPort: 'primary', toModule: 'vco', toPort: 'vOct' }
            ];

            const created = applyCables(cables, { container, addCable });

            expect(addCable).not.toHaveBeenCalled();
            expect(created.length).toBe(0);
        });

        it('should handle null cables', () => {
            const result = applyCables(null, { container, addCable: vi.fn() });
            expect(result).toEqual([]);
        });

        it('should handle missing addCable', () => {
            const result = applyCables([], { container });
            expect(result).toEqual([]);
        });
    });

    describe('applyParams', () => {
        it('applies v2 params to controls and module instances', () => {
            const container = document.createElement('div');
            const knob = document.createElement('div');
            knob.className = 'knob';
            knob.dataset.module = 'vco';
            knob.dataset.param = 'freq';
            knob.dataset.value = '0';
            const sw = document.createElement('div');
            sw.className = 'switch';
            sw.dataset.module = 'vco';
            sw.dataset.param = 'sync';
            container.appendChild(knob);
            container.appendChild(sw);
            const modules = { vco: { instance: { params: { freq: 0, sync: 0 } } } };

            expect(applyParams({ vco: { freq: 440, sync: 1 } }, { container, modules })).toBe(2);
            expect(knob.dataset.value).toBe('440');
            expect(sw.classList.contains('on')).toBe(true);
            expect(modules.vco.instance.params.freq).toBe(440);
            expect(modules.vco.instance.params.sync).toBe(1);
        });
    });

    describe('applyPatchState', () => {
        let container;
        let modules;
        let clearCables;
        let addCable;

        beforeEach(() => {
            container = document.createElement('div');
            modules = {};
            clearCables = vi.fn();
            addCable = vi.fn(() => ({ id: '1' }));
        });

        it('should clear existing cables first', () => {
            const state = { version: 3, plugins: { core: 1 }, modules: [], params: {}, cables: [], midiMappings: {} };

            applyPatchState(state, { container, modules, clearCables, addCable });

            expect(clearCables).toHaveBeenCalled();
        });

        it('should apply all state components', () => {
            const knob = document.createElement('div');
            knob.className = 'knob';
            knob.dataset.module = 'vco';
            knob.dataset.param = 'freq';
            knob.dataset.value = '0';
            container.appendChild(knob);

            const sw = document.createElement('div');
            sw.className = 'switch';
            sw.dataset.module = 'lfo';
            sw.dataset.param = 'sync';
            container.appendChild(sw);

            const state = {
                version: 3, plugins: { core: 1 },
                modules: [
                    { id: 'vco', type: 'vco', row: 1, index: 0 },
                    { id: 'lfo', type: 'lfo', row: 1, index: 1 }
                ],
                params: { vco: { freq: 440 }, lfo: { sync: 1 } },
                cables: [],
                midiMappings: {}
            };

            applyPatchState(state, { container, modules, clearCables, addCable });

            expect(knob.dataset.value).toBe('440');
            expect(sw.classList.contains('on')).toBe(true);
        });

        it('should return applied counts', () => {
            const state = {
                version: 3, plugins: { core: 1 },
                modules: [{ id: 'vco', type: 'vco', row: 1, index: 0 }],
                params: { vco: { freq: 440, sync: 1, octave: 2 }, lfo: { rate: 2 } },
                cables: [],
                midiMappings: {}
            };

            const result = applyPatchState(state, { container, modules, clearCables, addCable });

            expect(result.paramsApplied).toBe(4);
            expect(result.cablesCreated).toBe(0);
        });

        it('should reject missing state properties', () => {
            const state = { version: 3, plugins: { core: 1 }, modules: [], params: {}, cables: [] };

            expect(() => applyPatchState(state, { container, modules, clearCables, addCable }))
                .toThrow('Patch state midiMappings must be an object');
        });
    });
});
