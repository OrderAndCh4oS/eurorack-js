import { describe, expect, it } from 'vitest';
import vcoDefinition from '../../src/js/modules/vco/index.js';
import vcfDefinition from '../../src/js/modules/vcf/index.js';
import dlyDefinition from '../../src/js/modules/dly/index.js';
import phaserDefinition from '../../src/js/modules/phaser/index.js';
import flangerDefinition from '../../src/js/modules/flanger/index.js';

function expectFiniteInside(outputs, limit) {
    Object.values(outputs).forEach(output => {
        expect(output.every(Number.isFinite)).toBe(true);
        expect(Math.max(...output.map(Math.abs))).toBeLessThanOrEqual(limit);
    });
}

describe('cross-module audio quality contracts', () => {
    it.each([44100, 48000, 96000])('bounds VCO above-Nyquist pitch and FM requests at %i Hz', sampleRate => {
        const dsp = vcoDefinition.createDSP({ sampleRate, bufferSize: 512 });
        dsp.params.coarse = 1;
        dsp.params.fine = 6;
        dsp.inputs.vOct.fill(5);
        dsp.inputs.fm.fill(5);
        for (let block = 0; block < 8; block++) dsp.process();
        expectFiniteInside(dsp.outputs, 5);
    });

    it.each([44100, 48000, 96000])('keeps resonant filter outputs on the audio rails at %i Hz', sampleRate => {
        const dsp = vcfDefinition.createDSP({ sampleRate, bufferSize: 512 });
        dsp.params.cutoff = 0.7;
        dsp.params.resonance = 1;
        for (let block = 0; block < 64; block++) {
            for (let index = 0; index < 512; index++) {
                dsp.inputs.audio[index] = 5 * Math.sin(2 * Math.PI * 440 * (block * 512 + index) / sampleRate);
                dsp.inputs.cutoffCV[index] = 5 * Math.sin(2 * Math.PI * 3 * (block * 512 + index) / sampleRate);
            }
            dsp.process();
            expectFiniteInside(dsp.outputs, 5);
        }
    });

    it.each([
        ['delay', dlyDefinition, ['audio']],
        ['phaser', phaserDefinition, ['inL', 'inR']],
        ['flanger', flangerDefinition, ['inL', 'inR']]
    ])('keeps %s feedback finite and bounded during a long extreme run', (_name, definition, inputs) => {
        const dsp = definition.createDSP({ sampleRate: 48000, bufferSize: 128 });
        if ('feedback' in dsp.params) dsp.params.feedback = 1;
        if ('mix' in dsp.params) dsp.params.mix = 1;
        if ('depth' in dsp.params) dsp.params.depth = 1;
        for (let block = 0; block < 500; block++) {
            inputs.forEach(port => {
                for (let index = 0; index < 128; index++) {
                    dsp.inputs[port][index] = 5 * Math.sin(2 * Math.PI * 997 * (block * 128 + index) / 48000);
                }
            });
            dsp.process();
            expectFiniteInside(dsp.outputs, 5);
        }
    });
});
