import { describe, expect, it } from 'vitest';
import send from '../../src/js/modules/octo-send/index.js';
import { renderModule } from '../../src/js/ui/renderer.js';

const lanes = ['in1', 'in2', 'in3', 'in4', 'in5', 'in6', 'in7', 'in8'];

describe('Octo Send', () => {
    it('renders eight numbered inputs and a separate LINK output', () => {
        const dsp = send.createDSP();
        expect(send).toMatchObject({ id: 'octo-send', hp: 6, category: 'utility' });
        expect(dsp.params).toEqual({});
        expect(dsp.leds).toEqual({});
        const panel = renderModule(send, 'send-in-row-2', { dsp });
        const grids = panel.querySelectorAll('.socket-grid');
        expect(grids).toHaveLength(2);
        expect([...grids[0].querySelectorAll('.jack.input[data-signal="any"]')].map(jack => jack.dataset.port)).toEqual(lanes);
        expect([...grids[0].querySelectorAll('.jack-label')].map(label => label.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
        expect(grids[0].style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
        expect(grids[1].querySelector('.jack.output[data-signal="octo-link"]').dataset.port).toBe('link');
        expect(grids[1].textContent).toBe('LINK');
    });

    it.each([128, 512])('owns independent stable, resettable %i-sample buffers', bufferSize => {
        const dsp = send.createDSP({ bufferSize });
        const ports = { ...dsp.inputs, ...dsp.outputs };
        expect(Object.keys(dsp.inputs)).toEqual(lanes);
        expect(Object.keys(dsp.outputs)).toEqual(['link']);
        expect(new Set(Object.values(ports)).size).toBe(9);
        for (const buffer of Object.values(ports)) {
            expect(buffer).toBeInstanceOf(Float32Array);
            expect(buffer).toHaveLength(bufferSize);
            expect(buffer.every(value => value === 0)).toBe(true);
        }
        dsp.inputs.in1.fill(-5);
        dsp.inputs.in8[bufferSize - 1] = 10;
        dsp.process();
        expect(dsp.outputs.link.every(value => value === 0)).toBe(true);

        for (const buffer of Object.values(ports)) buffer.fill(7);
        dsp.reset();
        for (const [id, buffer] of Object.entries(ports)) {
            expect(dsp.inputs[id] ?? dsp.outputs[id]).toBe(buffer);
            expect(buffer.every(value => value === 0)).toBe(true);
        }
    });
});
