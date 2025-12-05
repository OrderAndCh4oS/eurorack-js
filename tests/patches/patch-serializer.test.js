import { describe, it, expect, beforeEach } from 'vitest';
import {
    serializeKnobs,
    serializeSwitches,
    serializeButtons,
    serializeCables,
    serializePatchState,
    createPatch,
    isValidPatchState
} from '../../src/js/patches/patch-serializer.js';

describe('patch-serializer', () => {
    describe('serializeKnobs', () => {
        let container;

        beforeEach(() => {
            container = document.createElement('div');
        });

        it('should serialize knob values', () => {
            const knob = document.createElement('div');
            knob.className = 'knob';
            knob.dataset.module = 'vco';
            knob.dataset.param = 'frequency';
            knob.dataset.value = '440';
            container.appendChild(knob);

            const result = serializeKnobs(container);
            expect(result).toEqual({
                vco: { frequency: 440 }
            });
        });

        it('should group knobs by module', () => {
            const knob1 = document.createElement('div');
            knob1.className = 'knob';
            knob1.dataset.module = 'vco';
            knob1.dataset.param = 'frequency';
            knob1.dataset.value = '440';

            const knob2 = document.createElement('div');
            knob2.className = 'knob';
            knob2.dataset.module = 'vco';
            knob2.dataset.param = 'pulseWidth';
            knob2.dataset.value = '0.5';

            container.appendChild(knob1);
            container.appendChild(knob2);

            const result = serializeKnobs(container);
            expect(result.vco.frequency).toBe(440);
            expect(result.vco.pulseWidth).toBe(0.5);
        });

        it('should handle multiple modules', () => {
            const knob1 = document.createElement('div');
            knob1.className = 'knob';
            knob1.dataset.module = 'vco';
            knob1.dataset.param = 'frequency';
            knob1.dataset.value = '440';

            const knob2 = document.createElement('div');
            knob2.className = 'knob';
            knob2.dataset.module = 'lfo';
            knob2.dataset.param = 'rate';
            knob2.dataset.value = '2';

            container.appendChild(knob1);
            container.appendChild(knob2);

            const result = serializeKnobs(container);
            expect(result.vco.frequency).toBe(440);
            expect(result.lfo.rate).toBe(2);
        });

        it('should return empty object for no knobs', () => {
            const result = serializeKnobs(container);
            expect(result).toEqual({});
        });
    });

    describe('serializeSwitches', () => {
        let container;

        beforeEach(() => {
            container = document.createElement('div');
        });

        it('should serialize switch states', () => {
            const sw = document.createElement('div');
            sw.className = 'switch on';
            sw.dataset.module = 'lfo';
            sw.dataset.param = 'sync';
            container.appendChild(sw);

            const result = serializeSwitches(container);
            expect(result).toEqual({
                lfo: { sync: true }
            });
        });

        it('should serialize off switches', () => {
            const sw = document.createElement('div');
            sw.className = 'switch';
            sw.dataset.module = 'lfo';
            sw.dataset.param = 'sync';
            container.appendChild(sw);

            const result = serializeSwitches(container);
            expect(result).toEqual({
                lfo: { sync: false }
            });
        });

        it('should handle multiple switches', () => {
            const sw1 = document.createElement('div');
            sw1.className = 'switch on';
            sw1.dataset.module = 'vco';
            sw1.dataset.param = 'hardSync';

            const sw2 = document.createElement('div');
            sw2.className = 'switch';
            sw2.dataset.module = 'vco';
            sw2.dataset.param = 'lfoMod';

            container.appendChild(sw1);
            container.appendChild(sw2);

            const result = serializeSwitches(container);
            expect(result.vco.hardSync).toBe(true);
            expect(result.vco.lfoMod).toBe(false);
        });
    });

    describe('serializeButtons', () => {
        let container;

        beforeEach(() => {
            container = document.createElement('div');
        });

        it('should serialize button bank values', () => {
            const bank = document.createElement('div');
            bank.className = 'button-bank';
            bank.dataset.module = 'vco';
            bank.dataset.param = 'octave';

            const btn = document.createElement('button');
            btn.className = 'octave-btn active';
            btn.dataset.value = '2';
            bank.appendChild(btn);

            container.appendChild(bank);

            const result = serializeButtons(container);
            expect(result).toEqual({
                vco: { octave: 2 }
            });
        });

        it('should return 0 if no active button', () => {
            const bank = document.createElement('div');
            bank.className = 'button-bank';
            bank.dataset.module = 'vco';
            bank.dataset.param = 'octave';

            const btn = document.createElement('button');
            btn.className = 'octave-btn';
            btn.dataset.value = '2';
            bank.appendChild(btn);

            container.appendChild(bank);

            const result = serializeButtons(container);
            expect(result).toEqual({
                vco: { octave: 0 }
            });
        });
    });

    describe('serializeCables', () => {
        it('should serialize cable connections', () => {
            const cables = [
                { id: '1', fromModule: 'lfo', fromPort: 'primary', toModule: 'vco', toPort: 'vOct', color: '#ff0000' },
                { id: '2', fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In', color: '#00ff00' }
            ];

            const result = serializeCables(cables);
            expect(result).toEqual([
                { fromModule: 'lfo', fromPort: 'primary', toModule: 'vco', toPort: 'vOct' },
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' }
            ]);
        });

        it('should strip extra properties', () => {
            const cables = [
                { id: '1', fromModule: 'lfo', fromPort: 'out', toModule: 'vco', toPort: 'in', color: '#ff0000', extra: 'data' }
            ];

            const result = serializeCables(cables);
            expect(result[0]).not.toHaveProperty('id');
            expect(result[0]).not.toHaveProperty('color');
            expect(result[0]).not.toHaveProperty('extra');
        });

        it('should handle empty cable array', () => {
            const result = serializeCables([]);
            expect(result).toEqual([]);
        });
    });

    describe('serializePatchState', () => {
        it('should serialize complete patch state', () => {
            const container = document.createElement('div');

            const knob = document.createElement('div');
            knob.className = 'knob';
            knob.dataset.module = 'vco';
            knob.dataset.param = 'freq';
            knob.dataset.value = '440';
            container.appendChild(knob);

            const sw = document.createElement('div');
            sw.className = 'switch on';
            sw.dataset.module = 'lfo';
            sw.dataset.param = 'sync';
            container.appendChild(sw);

            const cables = [
                { id: '1', fromModule: 'lfo', fromPort: 'out', toModule: 'vco', toPort: 'fm', color: '#f00' }
            ];

            const result = serializePatchState({ container, cables });

            expect(result.knobs).toEqual({ vco: { freq: 440 } });
            expect(result.switches).toEqual({ lfo: { sync: true } });
            expect(result.buttons).toEqual({});
            expect(result.cables).toEqual([
                { fromModule: 'lfo', fromPort: 'out', toModule: 'vco', toPort: 'fm' }
            ]);
        });
    });

    describe('createPatch', () => {
        it('should create a named patch object', () => {
            const state = { knobs: {}, cables: [] };
            const patch = createPatch('My Patch', state);

            expect(patch.name).toBe('My Patch');
            expect(patch.factory).toBe(false);
            expect(patch.created).toBeDefined();
            expect(patch.state).toBe(state);
        });

        it('should mark factory patches', () => {
            const state = { knobs: {}, cables: [] };
            const patch = createPatch('Factory Patch', state, true);

            expect(patch.factory).toBe(true);
        });

        it('should include ISO timestamp', () => {
            const state = { knobs: {}, cables: [] };
            const patch = createPatch('Test', state);

            expect(() => new Date(patch.created)).not.toThrow();
        });
    });

    describe('isValidPatchState', () => {
        it('should validate valid state', () => {
            const state = {
                knobs: { vco: { freq: 440 } },
                cables: [
                    { fromModule: 'lfo', fromPort: 'out', toModule: 'vco', toPort: 'fm' }
                ]
            };

            expect(isValidPatchState(state)).toBe(true);
        });

        it('should accept state with empty knobs and cables', () => {
            const state = { knobs: {}, cables: [] };
            expect(isValidPatchState(state)).toBe(true);
        });

        it('should reject null state', () => {
            expect(isValidPatchState(null)).toBe(false);
        });

        it('should reject non-object state', () => {
            expect(isValidPatchState('string')).toBe(false);
            expect(isValidPatchState(123)).toBe(false);
        });

        it('should reject state without knobs', () => {
            const state = { cables: [] };
            expect(isValidPatchState(state)).toBe(false);
        });

        it('should reject state without cables', () => {
            const state = { knobs: {} };
            expect(isValidPatchState(state)).toBe(false);
        });

        it('should reject state with invalid knobs', () => {
            const state = { knobs: 'invalid', cables: [] };
            expect(isValidPatchState(state)).toBe(false);
        });

        it('should reject state with invalid cables', () => {
            const state = { knobs: {}, cables: 'invalid' };
            expect(isValidPatchState(state)).toBe(false);
        });

        it('should reject cables missing fromModule', () => {
            const state = {
                knobs: {},
                cables: [{ fromPort: 'out', toModule: 'vco', toPort: 'in' }]
            };
            expect(isValidPatchState(state)).toBe(false);
        });

        it('should reject cables missing toPort', () => {
            const state = {
                knobs: {},
                cables: [{ fromModule: 'lfo', fromPort: 'out', toModule: 'vco' }]
            };
            expect(isValidPatchState(state)).toBe(false);
        });
    });
});
