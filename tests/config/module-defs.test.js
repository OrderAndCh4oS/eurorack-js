import { describe, it, expect, beforeEach } from 'vitest';
import { createModuleDefs, MODULE_ORDER } from '../../src/js/config/module-defs.js';

describe('module-defs', () => {
    describe('createModuleDefs', () => {
        it('should create module definitions object', () => {
            const defs = createModuleDefs();
            expect(typeof defs).toBe('object');
        });

        it('should include all expected modules', () => {
            const defs = createModuleDefs();
            const expectedModules = ['lfo', 'vco', 'vca', 'quant', 'arp', 'vcf', 'adsr', 'nse', 'sh', 'clk', 'div', 'out'];

            expectedModules.forEach(mod => {
                expect(defs[mod]).toBeDefined();
            });
        });

        it('should have required properties for each module', () => {
            const defs = createModuleDefs();

            Object.values(defs).forEach(def => {
                expect(def.name).toBeDefined();
                expect(typeof def.name).toBe('string');
                expect(def.hp).toBeDefined();
                expect(typeof def.hp).toBe('number');
                expect(def.color).toBeDefined();
                expect(def.create).toBeDefined();
                expect(typeof def.create).toBe('function');
                expect(def.knobs).toBeDefined();
                expect(Array.isArray(def.knobs)).toBe(true);
                expect(def.inputs).toBeDefined();
                expect(Array.isArray(def.inputs)).toBe(true);
            });
        });
    });

    describe('module definitions', () => {
        let defs;

        beforeEach(() => {
            defs = createModuleDefs();
        });

        describe('LFO', () => {
            it('should have correct configuration', () => {
                expect(defs.lfo.name).toBe('LFO');
                expect(defs.lfo.hp).toBe(4);
                expect(defs.lfo.knobs.length).toBe(2);
                expect(defs.lfo.outputs.length).toBe(2);
            });

            it('should create a working LFO instance', () => {
                const lfo = defs.lfo.create();
                expect(lfo.params).toBeDefined();
                expect(lfo.outputs).toBeDefined();
                expect(typeof lfo.process).toBe('function');
            });
        });

        describe('VCO', () => {
            it('should have correct configuration', () => {
                expect(defs.vco.name).toBe('VCO');
                expect(defs.vco.knobs.length).toBe(3);
                expect(defs.vco.outputs.length).toBe(3);
            });

            it('should create a working VCO instance', () => {
                const vco = defs.vco.create();
                expect(vco.params.coarse).toBeDefined();
                expect(vco.outputs.triangle).toBeDefined();
            });
        });

        describe('VCA', () => {
            it('should have LEDs defined', () => {
                expect(defs.vca.leds).toBeDefined();
                expect(defs.vca.leds).toContain('ch1');
                expect(defs.vca.leds).toContain('ch2');
            });
        });

        describe('QUANT (Simple Quantizer)', () => {
            it('should be 4hp wide', () => {
                expect(defs.quant.hp).toBe(4);
            });

            it('should have 3 knobs (Scale, Octave, Semitone)', () => {
                expect(defs.quant.knobs.length).toBe(3);
                const knobIds = defs.quant.knobs.map(k => k.id);
                expect(knobIds).toContain('scale');
                expect(knobIds).toContain('octave');
                expect(knobIds).toContain('semitone');
            });

            it('should have CV input', () => {
                expect(defs.quant.inputs.length).toBe(1);
                expect(defs.quant.inputs[0].id).toBe('cv');
            });

            it('should have CV and trigger outputs', () => {
                expect(defs.quant.outputs.length).toBe(2);
                const outputIds = defs.quant.outputs.map(o => o.id);
                expect(outputIds).toContain('cv');
                expect(outputIds).toContain('trigger');
            });

            it('should have active LED', () => {
                expect(defs.quant.leds).toContain('active');
            });

            it('should create a working quantizer instance', () => {
                const quant = defs.quant.create();
                expect(quant.params).toBeDefined();
                expect(quant.outputs).toBeDefined();
                expect(typeof quant.process).toBe('function');
            });
        });

        describe('ARP (Arpeggiator)', () => {
            it('should be 4hp wide', () => {
                expect(defs.arp.hp).toBe(4);
            });

            it('should have 3 knobs (Root, Chord, Mode)', () => {
                expect(defs.arp.knobs.length).toBe(3);
                const knobIds = defs.arp.knobs.map(k => k.id);
                expect(knobIds).toContain('root');
                expect(knobIds).toContain('chord');
                expect(knobIds).toContain('mode');
            });

            it('should have octave switch', () => {
                expect(defs.arp.switches.length).toBe(1);
                expect(defs.arp.switches[0].id).toBe('octaves');
            });

            it('should have trigger, reset, and CV inputs', () => {
                expect(defs.arp.inputs.length).toBe(4);
                const inputIds = defs.arp.inputs.map(i => i.id);
                expect(inputIds).toContain('trigger');
                expect(inputIds).toContain('reset');
                expect(inputIds).toContain('rootCV');
                expect(inputIds).toContain('chordCV');
            });

            it('should have V/Oct output', () => {
                expect(defs.arp.outputs.length).toBe(1);
                expect(defs.arp.outputs[0].id).toBe('cv');
            });

            it('should have step LED', () => {
                expect(defs.arp.leds).toContain('step');
            });

            it('should create a working arp instance', () => {
                const arp = defs.arp.create();
                expect(arp.params).toBeDefined();
                expect(arp.outputs).toBeDefined();
                expect(typeof arp.process).toBe('function');
            });
        });

        describe('VCF', () => {
            it('should have cutoff and resonance knobs', () => {
                const knobIds = defs.vcf.knobs.map(k => k.id);
                expect(knobIds).toContain('cutoff');
                expect(knobIds).toContain('resonance');
            });

            it('should have 3 filter outputs', () => {
                expect(defs.vcf.outputs.length).toBe(3);
            });
        });

        describe('ADSR', () => {
            it('should have 4 knobs for A, D, S, R', () => {
                expect(defs.adsr.knobs.length).toBe(4);
            });
        });

        describe('OUT', () => {
            it('should have no outputs', () => {
                expect(defs.out.outputs.length).toBe(0);
            });

            it('should have L and R inputs', () => {
                const inputIds = defs.out.inputs.map(i => i.id);
                expect(inputIds).toContain('L');
                expect(inputIds).toContain('R');
            });
        });
    });

    describe('MODULE_ORDER', () => {
        it('should include all modules in processing order', () => {
            expect(MODULE_ORDER).toContain('clk');
            expect(MODULE_ORDER).toContain('div');
            expect(MODULE_ORDER).toContain('lfo');
            expect(MODULE_ORDER).toContain('quant');
            expect(MODULE_ORDER).toContain('arp');
            expect(MODULE_ORDER).toContain('vco');
            expect(MODULE_ORDER).toContain('out');
        });

        it('should have clk first (master timing)', () => {
            expect(MODULE_ORDER[0]).toBe('clk');
        });

        it('should have out last (final output)', () => {
            expect(MODULE_ORDER[MODULE_ORDER.length - 1]).toBe('out');
        });

        it('should have quant and arp before vco (for pitch CV)', () => {
            const quantIndex = MODULE_ORDER.indexOf('quant');
            const arpIndex = MODULE_ORDER.indexOf('arp');
            const vcoIndex = MODULE_ORDER.indexOf('vco');
            expect(quantIndex).toBeLessThan(vcoIndex);
            expect(arpIndex).toBeLessThan(vcoIndex);
        });
    });
});
