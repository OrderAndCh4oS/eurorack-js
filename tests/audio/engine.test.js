import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAudioEngine, createMockAudioContext } from '../../src/js/audio/engine.js';
import { create2hpLFO } from '../../src/js/dsp/lfo.js';
import { create2hpVCO } from '../../src/js/dsp/vco.js';
import { create2hpDualVCA } from '../../src/js/dsp/vca.js';

describe('createAudioEngine', () => {
    let engine;
    let mockCtx;
    let modules;
    let cables;

    beforeEach(() => {
        mockCtx = createMockAudioContext();

        // Create test modules
        modules = {
            lfo: { instance: create2hpLFO(), type: 'lfo' },
            vco: { instance: create2hpVCO(), type: 'vco' },
            vca: { instance: create2hpDualVCA(), type: 'vca' }
        };

        cables = [];

        engine = createAudioEngine({
            modules,
            cables,
            audioCtx: mockCtx
        });
    });

    describe('initialization', () => {
        it('should create an engine with default state', () => {
            const eng = createAudioEngine();
            expect(eng.running).toBe(false);
        });

        it('should accept modules and cables', () => {
            expect(engine).toBeDefined();
            expect(engine.running).toBe(false);
        });
    });

    describe('start/stop', () => {
        it('should start the engine', () => {
            engine.start();
            expect(engine.running).toBe(true);
            engine.stop();
        });

        it('should stop the engine', () => {
            engine.start();
            engine.stop();
            expect(engine.running).toBe(false);
        });

        it('should throw if started without AudioContext', () => {
            const eng = createAudioEngine({ modules: {} });
            expect(() => eng.start()).toThrow('AudioContext required');
        });

        it('should not double-start', () => {
            engine.start();
            engine.start(); // Should not throw
            expect(engine.running).toBe(true);
            engine.stop();
        });
    });

    describe('tick()', () => {
        it('should process a single buffer', () => {
            const ledStates = engine.tick();
            expect(ledStates).toBeDefined();
        });

        it('should return LED states from modules', () => {
            const ledStates = engine.tick();

            // VCA should have LED states
            expect(ledStates.vca).toBeDefined();
        });

        it('should process LFO and produce output', () => {
            modules.lfo.instance.params.rateKnob = 0.9;

            for (let i = 0; i < 10; i++) {
                engine.tick();
            }

            const output = modules.lfo.instance.outputs.primary;
            expect(output.some(v => v > 0)).toBe(true);
        });
    });

    describe('signal routing', () => {
        it('should route LFO output to VCO input', () => {
            // Add a cable from LFO to VCO pitch
            cables.push({
                fromModule: 'lfo',
                fromPort: 'primary',
                toModule: 'vco',
                toPort: 'vOct'
            });
            engine.setCables(cables);

            // Process to generate LFO output
            modules.lfo.instance.params.rateKnob = 0.5;
            engine.tick();

            // VCO input should have received signal
            // (The routing happens before processing)
            expect(modules.vco.instance.inputs.vOct).toBeDefined();
        });

        it('should route buffer outputs correctly', () => {
            // VCO triangle to VCA input
            cables.push({
                fromModule: 'vco',
                fromPort: 'triangle',
                toModule: 'vca',
                toPort: 'ch1In'
            });
            engine.setCables(cables);

            // Process
            engine.tick();

            // VCA input should have audio data
            const vcaInput = modules.vca.instance.inputs.ch1In;
            expect(vcaInput).toBeInstanceOf(Float32Array);
        });

        it('should handle multiple cables', () => {
            cables.push(
                { fromModule: 'lfo', fromPort: 'primary', toModule: 'vco', toPort: 'vOct' },
                { fromModule: 'lfo', fromPort: 'secondary', toModule: 'vco', toPort: 'pwm' },
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' }
            );
            engine.setCables(cables);

            // Should process without error
            expect(() => engine.tick()).not.toThrow();
        });
    });

    describe('setModules()', () => {
        it('should update modules reference', () => {
            const newModules = {
                lfo: { instance: create2hpLFO(), type: 'lfo' }
            };

            engine.setModules(newModules);
            engine.tick();

            // Should work with new modules
            expect(newModules.lfo.instance.outputs.primary).toBeDefined();
        });
    });

    describe('setCables()', () => {
        it('should update cables reference', () => {
            const newCables = [
                { fromModule: 'lfo', fromPort: 'primary', toModule: 'vco', toPort: 'vOct' }
            ];

            engine.setCables(newCables);
            engine.tick();

            // Should work with new cables
            expect(engine).toBeDefined();
        });
    });

    describe('LED callback', () => {
        it('should call onLedUpdate with LED states', () => {
            const onLedUpdate = vi.fn();

            const eng = createAudioEngine({
                modules,
                cables: [],
                audioCtx: mockCtx,
                onLedUpdate
            });

            eng.start();

            // Wait for at least one callback
            return new Promise(resolve => {
                setTimeout(() => {
                    eng.stop();
                    expect(onLedUpdate).toHaveBeenCalled();
                    resolve();
                }, 50);
            });
        });
    });

    describe('routeSignals()', () => {
        it('should route signals to specific module', () => {
            cables.push({
                fromModule: 'lfo',
                fromPort: 'primary',
                toModule: 'vco',
                toPort: 'vOct'
            });
            engine.setCables(cables);

            // Process LFO first
            modules.lfo.instance.process();

            // Route to VCO
            engine.routeSignals('vco');

            // VCO should have received input
            expect(modules.vco.instance.inputs.vOct).toBeDefined();
        });

        it('should handle missing source module gracefully', () => {
            cables.push({
                fromModule: 'nonexistent',
                fromPort: 'output',
                toModule: 'vco',
                toPort: 'vOct'
            });
            engine.setCables(cables);

            // Should not throw
            expect(() => engine.routeSignals('vco')).not.toThrow();
        });

        it('should handle missing target module gracefully', () => {
            cables.push({
                fromModule: 'lfo',
                fromPort: 'primary',
                toModule: 'nonexistent',
                toPort: 'input'
            });
            engine.setCables(cables);

            // Should not throw
            expect(() => engine.routeSignals('nonexistent')).not.toThrow();
        });
    });
});

describe('createMockAudioContext', () => {
    it('should create a mock context', () => {
        const ctx = createMockAudioContext();
        expect(ctx.currentTime).toBe(0);
        expect(ctx.sampleRate).toBeDefined();
    });

    it('should advance time', () => {
        const ctx = createMockAudioContext();
        ctx.advanceTime(1);
        expect(ctx.currentTime).toBe(1);
    });
});
