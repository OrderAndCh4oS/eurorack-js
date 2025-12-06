import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAudioEngine, createMockAudioContext, computeProcessOrder } from '../../src/js/audio/engine.js';
import { create2hpLFO } from '../../src/js/dsp/lfo.js';
import { create2hpVCO } from '../../src/js/dsp/vco.js';
import { create2hpDualVCA } from '../../src/js/dsp/vca.js';
import { create2hpOut } from '../../src/js/dsp/output.js';

// Mock AudioContext for output module
class MockFullAudioContext {
    constructor() {
        this.currentTime = 0;
        this.sampleRate = 44100;
        this.destination = {};
    }
    createGain() {
        return { connect: vi.fn(), gain: { setValueAtTime: vi.fn() } };
    }
    createBuffer(channels, length, sampleRate) {
        const channelData = [new Float32Array(length), new Float32Array(length)];
        return { getChannelData: (ch) => channelData[ch] };
    }
    createBufferSource() {
        return { buffer: null, connect: vi.fn(), start: vi.fn() };
    }
    advanceTime(seconds) { this.currentTime += seconds; }
}

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

        it('should zero audio inputs when cables are disconnected', () => {
            // Connect VCO to VCA
            cables.push({
                fromModule: 'vco',
                fromPort: 'triangle',
                toModule: 'vca',
                toPort: 'ch1In'
            });
            engine.setCables(cables);

            // Process several cycles to get audio flowing
            for (let i = 0; i < 5; i++) {
                engine.tick();
            }

            // VCA should have received signal from VCO
            const vcaInputBefore = modules.vca.instance.inputs.ch1In;
            expect(vcaInputBefore.some(v => v !== 0)).toBe(true);

            // Now disconnect all cables
            engine.setCables([]);

            // VCA audio input should be zeroed
            const vcaInput = modules.vca.instance.inputs.ch1In;
            expect(vcaInput.every(v => v === 0)).toBe(true);
        });

        it('should silence output when all cables removed', () => {
            // Connect VCO to VCA
            cables.push({
                fromModule: 'vco',
                fromPort: 'triangle',
                toModule: 'vca',
                toPort: 'ch1In'
            });
            engine.setCables(cables);

            // Process to get audio
            for (let i = 0; i < 5; i++) {
                engine.tick();
            }

            // Remove cables
            engine.setCables([]);

            // Process again - output should be silent
            engine.tick();

            const vcaOutput = modules.vca.instance.outputs.ch1Out;
            expect(vcaOutput.every(v => v === 0)).toBe(true);
        });

        it('should silence output module when cables disconnected', () => {
            // Create engine with output module
            const fullCtx = new MockFullAudioContext();
            const modulesWithOut = {
                vco: { instance: create2hpVCO(), type: 'vco' },
                out: { instance: create2hpOut(fullCtx), type: 'out' }
            };
            const engWithOut = createAudioEngine({
                modules: modulesWithOut,
                cables: [],
                audioCtx: fullCtx
            });

            // Connect VCO to output
            engWithOut.setCables([{
                fromModule: 'vco',
                fromPort: 'triangle',
                toModule: 'out',
                toPort: 'L'
            }]);

            // Process to get audio flowing
            for (let i = 0; i < 5; i++) {
                engWithOut.tick();
            }

            // Output should have received audio
            expect(modulesWithOut.out.instance.leds.L).toBeGreaterThan(0);

            // Disconnect all cables
            engWithOut.setCables([]);

            // Output inputs should be zeroed
            expect(modulesWithOut.out.instance.inputs.L.every(v => v === 0)).toBe(true);

            // Process again
            engWithOut.tick();

            // LED should show silence
            expect(modulesWithOut.out.instance.leds.L).toBe(0);
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

describe('computeProcessOrder', () => {
    it('should return empty array for no modules', () => {
        expect(computeProcessOrder({}, [])).toEqual([]);
    });

    it('should return modules in MODULE_ORDER when no cables', () => {
        const modules = {
            vco: { instance: {} },
            lfo: { instance: {} },
            vca: { instance: {} }
        };
        const order = computeProcessOrder(modules, []);

        // Should follow MODULE_ORDER: lfo before vco before vca
        expect(order.indexOf('lfo')).toBeLessThan(order.indexOf('vco'));
        expect(order.indexOf('vco')).toBeLessThan(order.indexOf('vca'));
    });

    it('should process source before destination', () => {
        const modules = {
            vco: { instance: {} },
            vca: { instance: {} }
        };
        const cables = [
            { fromModule: 'vco', fromPort: 'out', toModule: 'vca', toPort: 'in' }
        ];
        const order = computeProcessOrder(modules, cables);

        expect(order.indexOf('vco')).toBeLessThan(order.indexOf('vca'));
    });

    it('should handle chain of modules', () => {
        const modules = {
            lfo: { instance: {} },
            vco: { instance: {} },
            vcf: { instance: {} },
            vca: { instance: {} }
        };
        const cables = [
            { fromModule: 'lfo', fromPort: 'out', toModule: 'vco', toPort: 'fm' },
            { fromModule: 'vco', fromPort: 'out', toModule: 'vcf', toPort: 'in' },
            { fromModule: 'vcf', fromPort: 'out', toModule: 'vca', toPort: 'in' }
        ];
        const order = computeProcessOrder(modules, cables);

        // Each source should be before its destination
        expect(order.indexOf('lfo')).toBeLessThan(order.indexOf('vco'));
        expect(order.indexOf('vco')).toBeLessThan(order.indexOf('vcf'));
        expect(order.indexOf('vcf')).toBeLessThan(order.indexOf('vca'));
    });

    it('should handle multiple sources to one destination', () => {
        const modules = {
            lfo: { instance: {} },
            nse: { instance: {} },
            vco: { instance: {} }
        };
        const cables = [
            { fromModule: 'lfo', fromPort: 'out', toModule: 'vco', toPort: 'fm' },
            { fromModule: 'nse', fromPort: 'out', toModule: 'vco', toPort: 'pwm' }
        ];
        const order = computeProcessOrder(modules, cables);

        // Both sources should be before destination
        expect(order.indexOf('lfo')).toBeLessThan(order.indexOf('vco'));
        expect(order.indexOf('nse')).toBeLessThan(order.indexOf('vco'));
    });

    it('should handle one source to multiple destinations', () => {
        const modules = {
            lfo: { instance: {} },
            vco: { instance: {} },
            vcf: { instance: {} }
        };
        const cables = [
            { fromModule: 'lfo', fromPort: 'out', toModule: 'vco', toPort: 'fm' },
            { fromModule: 'lfo', fromPort: 'out', toModule: 'vcf', toPort: 'cutoff' }
        ];
        const order = computeProcessOrder(modules, cables);

        // LFO should be before both destinations
        expect(order.indexOf('lfo')).toBeLessThan(order.indexOf('vco'));
        expect(order.indexOf('lfo')).toBeLessThan(order.indexOf('vcf'));
    });

    it('should handle cycles gracefully (feedback patches)', () => {
        const modules = {
            vco: { instance: {} },
            vcf: { instance: {} }
        };
        const cables = [
            { fromModule: 'vco', fromPort: 'out', toModule: 'vcf', toPort: 'in' },
            { fromModule: 'vcf', fromPort: 'out', toModule: 'vco', toPort: 'fm' }
        ];
        const order = computeProcessOrder(modules, cables);

        // Should include both modules (cycle handled)
        expect(order).toContain('vco');
        expect(order).toContain('vcf');
        expect(order.length).toBe(2);
    });

    it('should ignore self-loops', () => {
        const modules = {
            vco: { instance: {} }
        };
        const cables = [
            { fromModule: 'vco', fromPort: 'out', toModule: 'vco', toPort: 'fm' }
        ];
        const order = computeProcessOrder(modules, cables);

        expect(order).toEqual(['vco']);
    });

    it('should ignore cables with missing modules', () => {
        const modules = {
            vco: { instance: {} }
        };
        const cables = [
            { fromModule: 'lfo', fromPort: 'out', toModule: 'vco', toPort: 'fm' }
        ];
        const order = computeProcessOrder(modules, cables);

        expect(order).toEqual(['vco']);
    });

    it('should handle duplicate cables', () => {
        const modules = {
            lfo: { instance: {} },
            vco: { instance: {} }
        };
        const cables = [
            { fromModule: 'lfo', fromPort: 'out1', toModule: 'vco', toPort: 'fm' },
            { fromModule: 'lfo', fromPort: 'out2', toModule: 'vco', toPort: 'pwm' }
        ];
        const order = computeProcessOrder(modules, cables);

        expect(order.indexOf('lfo')).toBeLessThan(order.indexOf('vco'));
        expect(order.length).toBe(2);
    });
});

describe('engine processOrder integration', () => {
    it('should expose processOrder', () => {
        const modules = {
            lfo: { instance: create2hpLFO(), type: 'lfo' },
            vco: { instance: create2hpVCO(), type: 'vco' }
        };
        const engine = createAudioEngine({ modules, cables: [] });

        expect(engine.processOrder).toBeDefined();
        expect(Array.isArray(engine.processOrder)).toBe(true);
    });

    it('should update processOrder when cables change', () => {
        const modules = {
            lfo: { instance: create2hpLFO(), type: 'lfo' },
            vco: { instance: create2hpVCO(), type: 'vco' },
            vca: { instance: create2hpDualVCA(), type: 'vca' }
        };
        const engine = createAudioEngine({ modules, cables: [] });

        const initialOrder = engine.processOrder;

        // Add cable that creates dependency
        engine.setCables([
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' }
        ]);

        const newOrder = engine.processOrder;

        // VCO should be before VCA
        expect(newOrder.indexOf('vco')).toBeLessThan(newOrder.indexOf('vca'));
    });

    it('should update processOrder when modules change', () => {
        const modules = {
            lfo: { instance: create2hpLFO(), type: 'lfo' }
        };
        const engine = createAudioEngine({ modules, cables: [] });

        expect(engine.processOrder).toEqual(['lfo']);

        engine.setModules({
            lfo: { instance: create2hpLFO(), type: 'lfo' },
            vco: { instance: create2hpVCO(), type: 'vco' }
        });

        expect(engine.processOrder).toContain('lfo');
        expect(engine.processOrder).toContain('vco');
    });
});
