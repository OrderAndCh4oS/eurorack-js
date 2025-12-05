import { describe, it, expect } from 'vitest';
import { getNestedValue, setNestedValue } from '../../src/js/utils/nested-access.js';

describe('getNestedValue', () => {
    it('gets simple property', () => {
        const obj = { foo: 42, bar: 'hello' };
        expect(getNestedValue(obj, 'foo')).toBe(42);
        expect(getNestedValue(obj, 'bar')).toBe('hello');
    });

    it('gets array element with bracket notation', () => {
        const obj = { cv: [1, 2, 3, 4] };
        expect(getNestedValue(obj, 'cv[0]')).toBe(1);
        expect(getNestedValue(obj, 'cv[2]')).toBe(3);
    });

    it('gets Float32Array element', () => {
        const obj = { buffer: new Float32Array([0.5, 1.0, 1.5]) };
        expect(getNestedValue(obj, 'buffer[1]')).toBe(1.0);
    });

    it('handles module output structure', () => {
        const outputs = {
            cv: [
                new Float32Array([1, 2, 3]),
                new Float32Array([4, 5, 6])
            ],
            primary: new Float32Array([7, 8, 9])
        };
        expect(getNestedValue(outputs, 'cv[0]')).toBeInstanceOf(Float32Array);
        expect(getNestedValue(outputs, 'cv[1]')[0]).toBe(4);
        expect(getNestedValue(outputs, 'primary')).toBeInstanceOf(Float32Array);
    });
});

describe('setNestedValue', () => {
    it('sets simple property', () => {
        const obj = { foo: 0 };
        setNestedValue(obj, 'foo', 42);
        expect(obj.foo).toBe(42);
    });

    it('sets array element', () => {
        const obj = { cv: [0, 0, 0] };
        setNestedValue(obj, 'cv[1]', 99);
        expect(obj.cv[1]).toBe(99);
    });

    it('copies Float32Array data to Float32Array', () => {
        const obj = { buffer: new Float32Array(3) };
        const src = new Float32Array([1, 2, 3]);
        setNestedValue(obj, 'buffer', src);
        expect(Array.from(obj.buffer)).toEqual([1, 2, 3]);
    });

    it('copies Float32Array data to array element Float32Array', () => {
        const obj = {
            cv: [new Float32Array(3), new Float32Array(3)]
        };
        const src = new Float32Array([4, 5, 6]);
        setNestedValue(obj, 'cv[0]', src);
        expect(Array.from(obj.cv[0])).toEqual([4, 5, 6]);
    });

    it('extracts first element when setting scalar from Float32Array', () => {
        const obj = { vOct: 0 };
        const src = new Float32Array([2.5, 3.0, 3.5]);
        setNestedValue(obj, 'vOct', src);
        expect(obj.vOct).toBe(2.5);
    });

    it('extracts first element for array element scalar from Float32Array', () => {
        const obj = { trig: [0, 0, 0, 0] };
        const src = new Float32Array([5, 5, 5]);
        setNestedValue(obj, 'trig[0]', src);
        expect(obj.trig[0]).toBe(5);
    });

    it('fills Float32Array with scalar value', () => {
        const obj = { buffer: new Float32Array(4) };
        setNestedValue(obj, 'buffer', 2.5);
        expect(Array.from(obj.buffer)).toEqual([2.5, 2.5, 2.5, 2.5]);
    });

    it('handles typical cable routing scenario', () => {
        // LFO output (buffer) to VCO vOct input (scalar)
        const lfoOutputs = { primary: new Float32Array([2.5, 2.6, 2.7]) };
        const vcoInputs = { vOct: 0 };

        const srcValue = getNestedValue(lfoOutputs, 'primary');
        setNestedValue(vcoInputs, 'vOct', srcValue);

        expect(vcoInputs.vOct).toBe(2.5);
    });

    it('handles quantizer to VCO routing (buffer to buffer)', () => {
        const quantOutputs = {
            cv: [new Float32Array([1, 1, 1]), new Float32Array([2, 2, 2])]
        };
        const vcoInputs = { vOct: new Float32Array(3) };

        const srcValue = getNestedValue(quantOutputs, 'cv[0]');
        setNestedValue(vcoInputs, 'vOct', srcValue);

        expect(Array.from(vcoInputs.vOct)).toEqual([1, 1, 1]);
    });
});
