import { describe, expect, it } from 'vitest';
import logicModule from '../../src/js/modules/logic/index.js';

const createLogic = (options = {}) => logicModule.createDSP({
    sampleRate: 44100,
    bufferSize: 128,
    ...options
});

describe('Logic module', () => {
    it('declares the researched four-input, two-output panel contract', () => {
        const dsp = createLogic();

        expect(logicModule).toMatchObject({
            id: 'logic',
            name: 'LOGIC',
            hp: 4,
            category: 'utility'
        });
        expect(Object.keys(dsp.inputs)).toEqual(['andA', 'andB', 'orA', 'orB']);
        expect(Object.keys(dsp.outputs)).toEqual(['and', 'or']);
        expect(logicModule.ui.inputs.map(input => input.port)).toEqual([
            'andA', 'andB', 'orA', 'orB'
        ]);
        logicModule.ui.inputs.forEach(input => {
            expect(input.voltage).toEqual({ min: 0, max: 10, normal: 0 });
        });
        logicModule.ui.outputs.forEach(output => {
            expect(output.voltage).toEqual({ min: 0, max: 5 });
        });
    });

    it.each([
        [0, 0, 0],
        [5, 0, 0],
        [0, 5, 0],
        [5, 5, 5]
    ])('computes AND(%sV, %sV) as %sV', (a, b, expected) => {
        const dsp = createLogic();
        dsp.inputs.andA.fill(a);
        dsp.inputs.andB.fill(b);
        dsp.process();

        expect(dsp.outputs.and.every(value => value === expected)).toBe(true);
    });

    it.each([
        [0, 0, 0],
        [5, 0, 5],
        [0, 5, 5],
        [5, 5, 5]
    ])('computes OR(%sV, %sV) as %sV', (a, b, expected) => {
        const dsp = createLogic();
        dsp.onInputConnectionChange('orA', true);
        dsp.onInputConnectionChange('orB', true);
        dsp.inputs.orA.fill(a);
        dsp.inputs.orB.fill(b);
        dsp.process();

        expect(dsp.outputs.or.every(value => value === expected)).toBe(true);
    });

    it('uses the manual’s strictly-above-2.5V threshold', () => {
        const dsp = createLogic({ bufferSize: 4 });
        dsp.onInputConnectionChange('orA', true);
        dsp.onInputConnectionChange('orB', true);
        dsp.inputs.andA.set([2.499, 2.5, 2.501, 10]);
        dsp.inputs.andB.fill(10);
        dsp.inputs.orA.set([2.499, 2.5, 2.501, 10]);
        dsp.inputs.orB.fill(0);
        dsp.process();

        expect(Array.from(dsp.outputs.and)).toEqual([0, 0, 5, 5]);
        expect(Array.from(dsp.outputs.or)).toEqual([0, 0, 5, 5]);
    });

    it('processes both truth tables independently for every sample', () => {
        const dsp = createLogic({ bufferSize: 8 });
        dsp.onInputConnectionChange('orA', true);
        dsp.onInputConnectionChange('orB', true);
        for (let i = 0; i < 8; i++) {
            dsp.inputs.andA[i] = i % 2 ? 5 : 0;
            dsp.inputs.andB[i] = i % 4 < 2 ? 5 : 0;
            dsp.inputs.orA[i] = i % 3 ? 5 : 0;
            dsp.inputs.orB[i] = i % 5 ? 0 : 5;
        }
        dsp.process();

        for (let i = 0; i < 8; i++) {
            expect(dsp.outputs.and[i]).toBe(
                dsp.inputs.andA[i] > 2.5 && dsp.inputs.andB[i] > 2.5 ? 5 : 0
            );
            expect(dsp.outputs.or[i]).toBe(
                dsp.inputs.orA[i] > 2.5 || dsp.inputs.orB[i] > 2.5 ? 5 : 0
            );
        }
    });

    it('normals AND A/B to unpatched OR A/B by cable state', () => {
        const dsp = createLogic();
        dsp.inputs.andA.fill(5);
        dsp.inputs.andB.fill(0);
        dsp.process();
        expect(dsp.outputs.or.every(value => value === 5)).toBe(true);

        dsp.onInputConnectionChange('orA', true);
        dsp.onInputConnectionChange('orB', true);
        dsp.inputs.orA.fill(0);
        dsp.inputs.orB.fill(0);
        dsp.process();
        expect(dsp.outputs.or.every(value => value === 0)).toBe(true);

        dsp.onInputConnectionChange('orA', false);
        dsp.process();
        expect(dsp.outputs.or.every(value => value === 5)).toBe(true);
    });

    it('reports whether each output was active during the block', () => {
        const dsp = createLogic({ bufferSize: 8 });
        dsp.inputs.andA[3] = 5;
        dsp.inputs.andB[3] = 5;
        dsp.process();

        expect(dsp.leds).toEqual({ and: 1, or: 1 });
    });

    it('produces finite 0/5V gates and clears stable buffers on reset', () => {
        const dsp = createLogic();
        const inputs = { ...dsp.inputs };
        const outputs = { ...dsp.outputs };
        Object.values(dsp.inputs).forEach(input => input.fill(10));
        dsp.process();

        Object.values(dsp.outputs).forEach(output => {
            expect(output.every(value => value === 0 || value === 5)).toBe(true);
        });

        dsp.reset();
        Object.entries(inputs).forEach(([port, input]) => {
            expect(dsp.inputs[port]).toBe(input);
            expect(input.every(value => value === 0)).toBe(true);
        });
        Object.entries(outputs).forEach(([port, output]) => {
            expect(dsp.outputs[port]).toBe(output);
            expect(output.every(value => value === 0)).toBe(true);
        });
        expect(dsp.leds).toEqual({ and: 0, or: 0 });
    });
});
