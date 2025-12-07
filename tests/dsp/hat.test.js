import { describe, it, expect, beforeEach } from 'vitest';
import hatModule from '../../src/js/modules/hat/index.js';

const createHat = (options = {}) => hatModule.createDSP(options);

describe('2hp Hat - Hi-Hat Cymbal Synthesizer', () => {
    let hat;

    beforeEach(() => {
        hat = createHat();
    });

    describe('initialization', () => {
        it('should create a hat with default params', () => {
            expect(hat.params.decay).toBeDefined();
            expect(hat.params.sizzle).toBeDefined();
            expect(hat.params.blend).toBeDefined();
        });

        it('should have two trigger inputs (open and closed)', () => {
            expect(hat.inputs.trigOpen).toBeInstanceOf(Float32Array);
            expect(hat.inputs.trigClosed).toBeInstanceOf(Float32Array);
        });

        it('should create output buffer', () => {
            expect(hat.outputs.out).toBeInstanceOf(Float32Array);
            expect(hat.outputs.out.length).toBe(512);
        });

        it('should have LED indicator', () => {
            expect(hat.leds.active).toBe(0);
        });

        it('should accept custom options', () => {
            const customHat = createHat({ bufferSize: 256, sampleRate: 48000 });
            expect(customHat.outputs.out.length).toBe(256);
        });
    });

    describe('closed hat trigger', () => {
        it('should produce output when closed trigger fires', () => {
            hat.inputs.trigClosed[0] = 10;
            hat.inputs.trigClosed.fill(0, 1);
            hat.process();

            const hasOutput = hat.outputs.out.some(v => Math.abs(v) > 0.01);
            expect(hasOutput).toBe(true);
        });

        it('should have short decay for closed hat', () => {
            hat.inputs.trigClosed[0] = 10;
            hat.process();
            for (let i = 0; i < 5; i++) hat.process();
            const closedLevel = Math.max(...hat.outputs.out.map(Math.abs));

            // Closed hat should decay quickly
            expect(closedLevel).toBeLessThan(1);
        });

        it('should activate LED on closed trigger', () => {
            hat.inputs.trigClosed[0] = 10;
            hat.process();

            expect(hat.leds.active).toBeGreaterThan(0);
        });
    });

    describe('open hat trigger', () => {
        it('should produce output when open trigger fires', () => {
            hat.inputs.trigOpen[0] = 10;
            hat.inputs.trigOpen.fill(0, 1);
            hat.process();

            const hasOutput = hat.outputs.out.some(v => Math.abs(v) > 0.01);
            expect(hasOutput).toBe(true);
        });

        it('should have longer decay for open hat', () => {
            hat.params.decay = 0.7;

            // Closed hat
            hat.inputs.trigClosed[0] = 10;
            hat.process();
            hat.inputs.trigClosed.fill(0);
            for (let i = 0; i < 20; i++) hat.process();
            const closedLevel = Math.max(...hat.outputs.out.map(Math.abs));

            // Open hat
            hat.reset();
            hat.inputs.trigOpen[0] = 10;
            hat.process();
            hat.inputs.trigOpen.fill(0);
            for (let i = 0; i < 20; i++) hat.process();
            const openLevel = Math.max(...hat.outputs.out.map(Math.abs));

            // Open should sustain longer
            expect(openLevel).toBeGreaterThan(closedLevel);
        });

        it('should activate LED on open trigger', () => {
            hat.inputs.trigOpen[0] = 10;
            hat.process();

            expect(hat.leds.active).toBeGreaterThan(0);
        });
    });

    describe('choke behavior', () => {
        it('should choke open hat when closed trigger fires', () => {
            // Start open hat
            hat.inputs.trigOpen[0] = 10;
            hat.process();
            hat.inputs.trigOpen.fill(0);
            for (let i = 0; i < 3; i++) hat.process();

            // Now closed trigger should choke it
            hat.inputs.trigClosed[0] = 10;
            hat.process();
            hat.inputs.trigClosed.fill(0);
            for (let i = 0; i < 20; i++) hat.process();

            // Should decay like a closed hat (fast)
            const level = Math.max(...hat.outputs.out.map(Math.abs));
            expect(level).toBeLessThan(1);
        });
    });

    describe('decay control', () => {
        it('should affect overall decay time', () => {
            hat.params.decay = 0.1;
            hat.inputs.trigOpen[0] = 10;
            hat.process();
            for (let i = 0; i < 20; i++) hat.process();
            const shortDecayLevel = Math.max(...hat.outputs.out.map(Math.abs));

            hat.reset();
            hat.params.decay = 0.9;
            hat.inputs.trigOpen[0] = 10;
            hat.process();
            for (let i = 0; i < 20; i++) hat.process();
            const longDecayLevel = Math.max(...hat.outputs.out.map(Math.abs));

            expect(longDecayLevel).toBeGreaterThan(shortDecayLevel);
        });
    });

    describe('sizzle control', () => {
        it('should affect timbral character', () => {
            hat.params.sizzle = 0.1;
            hat.inputs.trigClosed[0] = 10;
            hat.process();
            const lowSizzleOutput = [...hat.outputs.out];

            hat.reset();
            hat.params.sizzle = 0.9;
            hat.inputs.trigClosed[0] = 10;
            hat.process();
            const highSizzleOutput = [...hat.outputs.out];

            // Should produce different output
            let difference = 0;
            for (let i = 0; i < 512; i++) {
                difference += Math.abs(lowSizzleOutput[i] - highSizzleOutput[i]);
            }
            expect(difference).toBeGreaterThan(0);
        });
    });

    describe('blend control', () => {
        it('should mix between metallic and robotic sounds', () => {
            hat.params.blend = 0.1;
            hat.inputs.trigClosed[0] = 10;
            hat.process();
            const lowBlendOutput = [...hat.outputs.out];

            hat.reset();
            hat.params.blend = 0.9;
            hat.inputs.trigClosed[0] = 10;
            hat.process();
            const highBlendOutput = [...hat.outputs.out];

            let difference = 0;
            for (let i = 0; i < 512; i++) {
                difference += Math.abs(lowBlendOutput[i] - highBlendOutput[i]);
            }
            expect(difference).toBeGreaterThan(0);
        });
    });

    describe('output characteristics', () => {
        it('should produce audio-range output', () => {
            hat.inputs.trigOpen[0] = 10;
            hat.process();

            const maxOutput = Math.max(...hat.outputs.out.map(Math.abs));
            expect(maxOutput).toBeLessThanOrEqual(10);
            expect(maxOutput).toBeGreaterThan(0);
        });

        it('should contain high-frequency content typical of cymbals', () => {
            hat.inputs.trigClosed[0] = 10;
            hat.process();

            // Check for high-frequency variation
            let variance = 0;
            for (let i = 1; i < 512; i++) {
                const diff = hat.outputs.out[i] - hat.outputs.out[i-1];
                variance += diff * diff;
            }
            variance /= 511;

            // Should have significant high-frequency content
            expect(variance).toBeGreaterThan(0.01);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffer', () => {
            hat.inputs.trigClosed[0] = 10;
            hat.process();

            expect(hat.outputs.out.every(v => !isNaN(v))).toBe(true);
        });

        it('should produce no NaN values', () => {
            hat.process();
            expect(hat.outputs.out.every(v => !isNaN(v))).toBe(true);
        });
    });

    describe('reset', () => {
        it('should clear output and state on reset', () => {
            hat.inputs.trigOpen[0] = 10;
            hat.process();
            hat.reset();

            expect(hat.outputs.out[0]).toBe(0);
            expect(hat.leds.active).toBe(0);
        });
    });

    describe('module metadata', () => {
        it('should have correct module ID', () => {
            expect(hatModule.id).toBe('hat');
        });

        it('should have correct HP width', () => {
            expect(hatModule.hp).toBe(3);
        });

        it('should have 3 knobs (decay, sizzle, blend)', () => {
            expect(hatModule.ui.knobs.length).toBe(3);
        });

        it('should have 2 trigger inputs (open and closed)', () => {
            const triggerInputs = hatModule.ui.inputs.filter(i => i.type === 'trigger');
            expect(triggerInputs.length).toBe(2);
        });

        it('should have 1 output', () => {
            expect(hatModule.ui.outputs.length).toBe(1);
        });
    });
});
