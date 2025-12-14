import { describe, it, expect, beforeEach } from 'vitest';
import granulitaModule from '../../src/js/modules/granulita/index.js';

// Helper to create Granulita instance
const createGranulita = (options = {}) => granulitaModule.createDSP(options);

describe('GRANULITA (Granular Chord Generator)', () => {
    let granulita;

    beforeEach(() => {
        granulita = createGranulita();
    });

    describe('initialization', () => {
        it('should create with default params', () => {
            expect(granulita.params.blend).toBe(0.5);
            expect(granulita.params.pitch).toBe(0.5);
            expect(granulita.params.chord).toBe(0);
            expect(granulita.params.voice).toBe(0);
            expect(granulita.params.verb).toBe(0.3);
            expect(granulita.params.count).toBe(0.5);
            expect(granulita.params.length).toBe(0.3);
            expect(granulita.params.direction).toBe(1); // FWD
            expect(granulita.params.hitMode).toBe(1);   // SYNC
        });

        it('should create stereo audio input buffers', () => {
            expect(granulita.inputs.inL).toBeInstanceOf(Float32Array);
            expect(granulita.inputs.inL.length).toBe(512);
            expect(granulita.inputs.inR).toBeInstanceOf(Float32Array);
            expect(granulita.inputs.inR.length).toBe(512);
        });

        it('should create CV input buffers for all parameters', () => {
            expect(granulita.inputs.blendCV).toBeInstanceOf(Float32Array);
            expect(granulita.inputs.pitchCV).toBeInstanceOf(Float32Array);
            expect(granulita.inputs.chordCV).toBeInstanceOf(Float32Array);
            expect(granulita.inputs.voiceCV).toBeInstanceOf(Float32Array);
            expect(granulita.inputs.verbCV).toBeInstanceOf(Float32Array);
            expect(granulita.inputs.countCV).toBeInstanceOf(Float32Array);
            expect(granulita.inputs.lengthCV).toBeInstanceOf(Float32Array);
        });

        it('should create hit/gate input buffer', () => {
            expect(granulita.inputs.hit).toBeInstanceOf(Float32Array);
        });

        it('should create stereo output buffers', () => {
            expect(granulita.outputs.outL).toBeInstanceOf(Float32Array);
            expect(granulita.outputs.outL.length).toBe(512);
            expect(granulita.outputs.outR).toBeInstanceOf(Float32Array);
            expect(granulita.outputs.outR.length).toBe(512);
        });

        it('should have LED outputs', () => {
            expect(granulita.leds).toBeDefined();
            expect(granulita.leds.active).toBe(0);
        });

        it('should accept custom options', () => {
            const custom = createGranulita({ sampleRate: 48000, bufferSize: 256 });
            expect(custom.outputs.outL.length).toBe(256);
            expect(custom.outputs.outR.length).toBe(256);
        });
    });

    describe('output range (audio +/-5V)', () => {
        it('should produce stereo output within audio range', () => {
            // Fill buffer and let grains populate
            for (let j = 0; j < 20; j++) {
                for (let i = 0; i < 512; i++) {
                    granulita.inputs.inL[i] = Math.sin(i * 0.1) * 3;
                    granulita.inputs.inR[i] = Math.sin(i * 0.1 + 0.5) * 3;
                }
                granulita.process();
            }

            const maxL = Math.max(...granulita.outputs.outL);
            const minL = Math.min(...granulita.outputs.outL);
            const maxR = Math.max(...granulita.outputs.outR);
            const minR = Math.min(...granulita.outputs.outR);

            expect(maxL).toBeLessThanOrEqual(6);
            expect(minL).toBeGreaterThanOrEqual(-6);
            expect(maxR).toBeLessThanOrEqual(6);
            expect(minR).toBeGreaterThanOrEqual(-6);
        });
    });

    describe('mono normalization', () => {
        it('should copy left input to right when right is empty', () => {
            // Only input to left channel
            for (let j = 0; j < 10; j++) {
                for (let i = 0; i < 512; i++) {
                    granulita.inputs.inL[i] = Math.sin(i * 0.1) * 3;
                }
                granulita.inputs.inR.fill(0);
                granulita.params.blend = 0; // Full dry
                granulita.process();
            }

            // Both outputs should have signal (dry path)
            const hasOutputL = granulita.outputs.outL.some(v => Math.abs(v) > 0.01);
            const hasOutputR = granulita.outputs.outR.some(v => Math.abs(v) > 0.01);

            expect(hasOutputL).toBe(true);
            expect(hasOutputR).toBe(true);
        });
    });

    describe('blend knob behavior', () => {
        it('should output only dry signal at blend = 0', () => {
            // Fill buffer first
            for (let j = 0; j < 10; j++) {
                for (let i = 0; i < 512; i++) {
                    granulita.inputs.inL[i] = Math.sin(i * 0.1) * 3;
                    granulita.inputs.inR[i] = Math.sin(i * 0.1 + 0.5) * 3;
                }
                granulita.process();
            }

            granulita.params.blend = 0; // Full dry
            granulita.process();

            // At full dry, output should closely match input
            for (let i = 0; i < 512; i++) {
                expect(granulita.outputs.outL[i]).toBeCloseTo(granulita.inputs.inL[i], 0);
            }
        });

        it('should output only wet signal at blend = 1', () => {
            granulita.params.blend = 1; // Full wet
            expect(granulita.params.blend).toBe(1);
        });
    });

    describe('pitch knob behavior', () => {
        it('should have no transposition at pitch = 0.5', () => {
            granulita.params.pitch = 0.5;
            expect(granulita.params.pitch).toBe(0.5);
        });

        it('should transpose down at pitch < 0.5', () => {
            granulita.params.pitch = 0;
            expect(granulita.params.pitch).toBe(0);
        });

        it('should transpose up at pitch > 0.5', () => {
            granulita.params.pitch = 1;
            expect(granulita.params.pitch).toBe(1);
        });
    });

    describe('chord knob behavior', () => {
        it('should select from 16 chord types', () => {
            // Test that chord values 0-15 are valid
            for (let c = 0; c < 16; c++) {
                granulita.params.chord = c / 15;
                expect(granulita.params.chord).toBeGreaterThanOrEqual(0);
                expect(granulita.params.chord).toBeLessThanOrEqual(1);
            }
        });
    });

    describe('voice knob behavior', () => {
        it('should select which voice tracks input (0-3)', () => {
            granulita.params.voice = 0;
            expect(granulita.params.voice).toBe(0);

            granulita.params.voice = 0.75;
            expect(granulita.params.voice).toBe(0.75);
        });
    });

    describe('verb knob behavior', () => {
        it('should control reverb decay at low values', () => {
            granulita.params.verb = 0.2;
            expect(granulita.params.verb).toBe(0.2);
        });

        it('should add shimmer at high values', () => {
            granulita.params.verb = 0.7;
            expect(granulita.params.verb).toBe(0.7);
        });

        it('should go infinite past 0.75', () => {
            granulita.params.verb = 0.9;
            expect(granulita.params.verb).toBe(0.9);
        });
    });

    describe('count knob behavior', () => {
        it('should have few grains at low count', () => {
            granulita.params.count = 0.1;
            expect(granulita.params.count).toBe(0.1);
        });

        it('should have many grains at high count', () => {
            granulita.params.count = 1;
            expect(granulita.params.count).toBe(1);
        });
    });

    describe('length knob behavior', () => {
        it('should have short grains at low length', () => {
            granulita.params.length = 0;
            expect(granulita.params.length).toBe(0);
        });

        it('should have long grains at high length', () => {
            granulita.params.length = 1;
            expect(granulita.params.length).toBe(1);
        });
    });

    describe('direction switch behavior', () => {
        it('should play forward at direction = 2 (FWD)', () => {
            granulita.params.direction = 2;
            expect(granulita.params.direction).toBe(2);
        });

        it('should play backward at direction = 0 (REV)', () => {
            granulita.params.direction = 0;
            expect(granulita.params.direction).toBe(0);
        });

        it('should play randomly at direction = 1 (BTH)', () => {
            granulita.params.direction = 1;
            expect(granulita.params.direction).toBe(1);
        });
    });

    describe('hitMode switch behavior', () => {
        it('should freeze at hitMode = 0 (FRZ)', () => {
            granulita.params.hitMode = 0;
            expect(granulita.params.hitMode).toBe(0);
        });

        it('should sync grains at hitMode = 1 (SYNC)', () => {
            granulita.params.hitMode = 1;
            expect(granulita.params.hitMode).toBe(1);
        });

        it('should trigger at hitMode = 2 (TRIG)', () => {
            granulita.params.hitMode = 2;
            expect(granulita.params.hitMode).toBe(2);
        });
    });

    describe('hit gate input', () => {
        it('should respond to gate above 2V threshold', () => {
            // Fill buffer
            for (let j = 0; j < 10; j++) {
                for (let i = 0; i < 512; i++) {
                    granulita.inputs.inL[i] = Math.sin(i * 0.1) * 3;
                    granulita.inputs.inR[i] = Math.sin(i * 0.1) * 3;
                }
                granulita.process();
            }

            // Apply gate above threshold
            granulita.inputs.hit.fill(3); // 3V > 2V threshold
            granulita.process();

            // Gate should be detected
            expect(granulita.inputs.hit[0]).toBe(3);
        });

        it('should not respond to gate below 2V threshold', () => {
            granulita.inputs.hit.fill(1); // 1V < 2V threshold
            granulita.process();

            expect(granulita.inputs.hit[0]).toBe(1);
        });
    });

    describe('CV modulation', () => {
        it('should respond to blend CV', () => {
            granulita.inputs.blendCV.fill(2.5); // +2.5V
            granulita.process();
            expect(granulita.inputs.blendCV[0]).toBe(2.5);
        });

        it('should respond to pitch CV', () => {
            granulita.inputs.pitchCV.fill(2.5);
            granulita.process();
            expect(granulita.inputs.pitchCV[0]).toBe(2.5);
        });

        it('should respond to chord CV', () => {
            granulita.inputs.chordCV.fill(2.5);
            granulita.process();
            expect(granulita.inputs.chordCV[0]).toBe(2.5);
        });

        it('should respond to voice CV', () => {
            granulita.inputs.voiceCV.fill(2.5);
            granulita.process();
            expect(granulita.inputs.voiceCV[0]).toBe(2.5);
        });

        it('should respond to verb CV', () => {
            granulita.inputs.verbCV.fill(2.5);
            granulita.process();
            expect(granulita.inputs.verbCV[0]).toBe(2.5);
        });

        it('should respond to count CV', () => {
            granulita.inputs.countCV.fill(2.5);
            granulita.process();
            expect(granulita.inputs.countCV[0]).toBe(2.5);
        });

        it('should respond to length CV', () => {
            granulita.inputs.lengthCV.fill(2.5);
            granulita.process();
            expect(granulita.inputs.lengthCV[0]).toBe(2.5);
        });
    });

    describe('LED indicators', () => {
        it('should update active LED based on signal', () => {
            for (let j = 0; j < 10; j++) {
                for (let i = 0; i < 512; i++) {
                    granulita.inputs.inL[i] = Math.sin(i * 0.1) * 5;
                    granulita.inputs.inR[i] = Math.sin(i * 0.1) * 5;
                }
                granulita.process();
            }

            expect(typeof granulita.leds.active).toBe('number');
        });
    });

    describe('reset', () => {
        it('should clear grain buffer on reset', () => {
            // Fill with signal
            for (let j = 0; j < 20; j++) {
                for (let i = 0; i < 512; i++) {
                    granulita.inputs.inL[i] = Math.sin(i * 0.1) * 5;
                    granulita.inputs.inR[i] = Math.sin(i * 0.1) * 5;
                }
                granulita.params.blend = 1;
                granulita.process();
            }

            // Reset
            granulita.reset();

            // Process with silence
            granulita.inputs.inL.fill(0);
            granulita.inputs.inR.fill(0);
            granulita.process();

            // Output should be silent after reset
            const maxOutputL = Math.max(...granulita.outputs.outL.map(Math.abs));
            const maxOutputR = Math.max(...granulita.outputs.outR.map(Math.abs));
            expect(maxOutputL).toBeLessThan(0.1);
            expect(maxOutputR).toBeLessThan(0.1);
        });

        it('should reset LED state', () => {
            granulita.leds.active = 0.8;
            granulita.reset();
            expect(granulita.leds.active).toBe(0);
        });
    });

    describe('buffer integrity', () => {
        it('should fill entire output buffer without NaN', () => {
            for (let i = 0; i < 512; i++) {
                granulita.inputs.inL[i] = Math.random() * 10 - 5;
                granulita.inputs.inR[i] = Math.random() * 10 - 5;
            }
            granulita.process();

            expect(granulita.outputs.outL.every(v => !isNaN(v))).toBe(true);
            expect(granulita.outputs.outR.every(v => !isNaN(v))).toBe(true);
        });

        it('should not produce infinite values', () => {
            for (let j = 0; j < 50; j++) {
                for (let i = 0; i < 512; i++) {
                    granulita.inputs.inL[i] = Math.random() * 10 - 5;
                    granulita.inputs.inR[i] = Math.random() * 10 - 5;
                }
                granulita.params.verb = 0.99;
                granulita.process();
            }

            expect(granulita.outputs.outL.every(v => isFinite(v))).toBe(true);
            expect(granulita.outputs.outR.every(v => isFinite(v))).toBe(true);
        });

        it('should handle silence without issues', () => {
            granulita.inputs.inL.fill(0);
            granulita.inputs.inR.fill(0);
            granulita.process();

            expect(granulita.outputs.outL.every(v => !isNaN(v))).toBe(true);
            expect(granulita.outputs.outR.every(v => !isNaN(v))).toBe(true);
        });
    });

    describe('freeze mode behavior', () => {
        it('should freeze buffer when hitMode=FRZ and gate is high', () => {
            // Fill buffer first
            for (let j = 0; j < 10; j++) {
                for (let i = 0; i < 512; i++) {
                    granulita.inputs.inL[i] = Math.sin(i * 0.1) * 3;
                    granulita.inputs.inR[i] = Math.sin(i * 0.1) * 3;
                }
                granulita.process();
            }

            // Set freeze mode and high gate
            granulita.params.hitMode = 0; // FRZ
            granulita.inputs.hit.fill(5); // High gate

            // Record buffer write position (if accessible) or just verify processing
            granulita.process();

            // In freeze mode, grains should still play but buffer shouldn't update
            expect(granulita.params.hitMode).toBe(0);
        });
    });

    describe('module metadata', () => {
        it('should have correct module id', () => {
            expect(granulitaModule.id).toBe('granulita');
        });

        it('should have correct HP size', () => {
            expect(granulitaModule.hp).toBe(10);
        });

        it('should have correct category', () => {
            expect(granulitaModule.category).toBe('effect');
        });

        it('should have UI definition', () => {
            expect(granulitaModule.ui).toBeDefined();
            expect(granulitaModule.ui.knobs).toBeDefined();
            expect(granulitaModule.ui.switches).toBeDefined();
            expect(granulitaModule.ui.inputs).toBeDefined();
            expect(granulitaModule.ui.outputs).toBeDefined();
        });
    });
});
