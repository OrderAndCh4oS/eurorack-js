import { describe, expect, it } from 'vitest';
import receive from '../../src/js/modules/octo-receive/index.js';
import { renderModule } from '../../src/js/ui/renderer.js';

const lanes = ['out1', 'out2', 'out3', 'out4', 'out5', 'out6', 'out7', 'out8'];

describe('Octo Receive', () => {
    it('renders eight numbered outputs and a separate LINK input', () => {
        const dsp = receive.createDSP();
        expect(receive).toMatchObject({ id: 'octo-receive', hp: 6, category: 'utility' });
        expect(dsp.params).toEqual({});
        expect(dsp.leds).toEqual({});
        const panel = renderModule(receive, 'receive-in-row-1', { dsp });
        const grids = panel.querySelectorAll('.socket-grid');
        expect(grids).toHaveLength(2);
        expect([...grids[0].querySelectorAll('.jack.output[data-signal="any"]')].map(jack => jack.dataset.port)).toEqual(lanes);
        expect([...grids[0].querySelectorAll('.jack-label')].map(label => label.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
        expect(grids[0].style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
        expect(grids[1].querySelector('.jack.input[data-signal="octo-link"]').dataset.port).toBe('link');
        expect(grids[1].textContent).toBe('LINK');
    });

    it.each([128, 512])('preserves whole graph-driven %i-sample lanes until reset', bufferSize => {
        const dsp = receive.createDSP({ bufferSize });
        const ports = { ...dsp.inputs, ...dsp.outputs };
        expect(Object.keys(dsp.inputs)).toEqual(['link']);
        expect(Object.keys(dsp.outputs)).toEqual(lanes);
        expect(new Set(Object.values(ports)).size).toBe(9);
        for (const buffer of Object.values(ports)) {
            expect(buffer).toBeInstanceOf(Float32Array);
            expect(buffer).toHaveLength(bufferSize);
            expect(buffer.every(value => value === 0)).toBe(true);
        }

        const pitch = Float32Array.from({ length: bufferSize }, (_, i) => i / 12);
        dsp.outputs.out1.set(pitch);
        dsp.outputs.out8[bufferSize - 1] = 10;
        dsp.process();
        expect(dsp.outputs.out1).toEqual(pitch);
        expect(dsp.outputs.out8[bufferSize - 1]).toBe(10);
        expect(dsp.outputs.out2.every(value => value === 0)).toBe(true);

        for (const buffer of Object.values(ports)) buffer.fill(-3);
        dsp.reset();
        for (const [id, buffer] of Object.entries(ports)) {
            expect(dsp.inputs[id] ?? dsp.outputs[id]).toBe(buffer);
            expect(buffer.every(value => value === 0)).toBe(true);
        }
    });
});
