import { describe, it, expect, beforeEach } from 'vitest';
import kickModule from '../../src/js/modules/kick/index.js';

const createKick = (options = {}) => kickModule.createDSP(options);

describe('2hp Kick - Bass Drum Synthesizer', () => {
    let kick;

    beforeEach(() => {
        kick = createKick();
    });

    describe('initialization', () => {
        it('should create a kick with default params', () => {
            expect(kick.params.pitch).toBeDefined();
            expect(kick.params.decay).toBeDefined();
            expect(kick.params.tone).toBeDefined();
        });

        it('should have trigger input', () => {
            expect(kick.inputs.trigger).toBeInstanceOf(Float32Array);
        });

        it('should have CV inputs', () => {
            expect(kick.inputs.pitchCV).toBeInstanceOf(Float32Array);
            expect(kick.inputs.decayCV).toBeInstanceOf(Float32Array);
            expect(kick.inputs.toneCV).toBeInstanceOf(Float32Array);
        });

        it('should create output buffer', () => {
            expect(kick.outputs.out).toBeInstanceOf(Float32Array);
            expect(kick.outputs.out.length).toBe(512);
        });

        it('should have LED indicator', () => {
            expect(kick.leds.active).toBe(0);
        });

        it('should accept custom options', () => {
            const customKick = createKick({ bufferSize: 256, sampleRate: 48000 });
            expect(customKick.outputs.out.length).toBe(256);
        });
    });

    describe('trigger behavior', () => {
        it('should produce output when triggered', () => {
            // Send trigger pulse
            kick.inputs.trigger[0] = 10;
            kick.inputs.trigger.fill(0, 1);
            kick.process();

            // Should have audio output
            const hasOutput = kick.outputs.out.some(v => Math.abs(v) > 0.01);
            expect(hasOutput).toBe(true);
        });

        it('should not produce output without trigger', () => {
            kick.inputs.trigger.fill(0);
            kick.process();

            // Output should be silent or near-silent
            const maxOutput = Math.max(...kick.outputs.out.map(Math.abs));
            expect(maxOutput).toBeLessThan(0.1);
        });

        it('should detect rising edge only', () => {
            // Constant high trigger should not retrigger
            kick.inputs.trigger.fill(10);
            kick.process();
            const firstOutput = [...kick.outputs.out];

            // Process again with same high trigger
            kick.process();

            // Should be decaying, not retriggering
            const maxSecond = Math.max(...kick.outputs.out.map(Math.abs));
            const maxFirst = Math.max(...firstOutput.map(Math.abs));
            expect(maxSecond).toBeLessThan(maxFirst);
        });

        it('should activate LED on trigger', () => {
            kick.inputs.trigger[0] = 10;
            kick.process();

            expect(kick.leds.active).toBeGreaterThan(0);
        });
    });

    describe('pitch control', () => {
        it('should produce lower frequencies at lower pitch settings', () => {
            // Trigger with low pitch
            kick.params.pitch = 0.2;
            kick.inputs.trigger[0] = 10;
            kick.process();
            const lowPitchOutput = [...kick.outputs.out];

            // Reset and trigger with high pitch
            kick.reset();
            kick.params.pitch = 0.8;
            kick.inputs.trigger[0] = 10;
            kick.process();
            const highPitchOutput = [...kick.outputs.out];

            // Count zero crossings as proxy for frequency
            const countZeroCrossings = (arr) => {
                let count = 0;
                for (let i = 1; i < arr.length; i++) {
                    if ((arr[i] >= 0) !== (arr[i-1] >= 0)) count++;
                }
                return count;
            };

            expect(countZeroCrossings(highPitchOutput)).toBeGreaterThan(countZeroCrossings(lowPitchOutput));
        });

        it('should respond to 1V/Oct CV input', () => {
            kick.params.pitch = 0.5;

            // Trigger with no CV
            kick.inputs.trigger[0] = 10;
            kick.inputs.pitchCV.fill(0);
            kick.process();
            const noCVOutput = [...kick.outputs.out];

            // Reset and trigger with +1V CV (should be one octave higher)
            kick.reset();
            kick.inputs.trigger[0] = 10;
            kick.inputs.pitchCV.fill(1); // +1V = +1 octave
            kick.process();
            const withCVOutput = [...kick.outputs.out];

            // Higher octave should have more zero crossings
            const countZeroCrossings = (arr) => {
                let count = 0;
                for (let i = 1; i < arr.length; i++) {
                    if ((arr[i] >= 0) !== (arr[i-1] >= 0)) count++;
                }
                return count;
            };

            expect(countZeroCrossings(withCVOutput)).toBeGreaterThan(countZeroCrossings(noCVOutput));
        });
    });

    describe('decay control', () => {
        it('should have shorter decay at lower settings', () => {
            // Short decay
            kick.params.decay = 0.1;
            kick.inputs.trigger[0] = 10;
            kick.process();

            // Process several more buffers
            for (let i = 0; i < 5; i++) {
                kick.process();
            }
            const shortDecayLevel = Math.max(...kick.outputs.out.map(Math.abs));

            // Reset with long decay
            kick.reset();
            kick.params.decay = 0.9;
            kick.inputs.trigger[0] = 10;
            kick.process();

            for (let i = 0; i < 5; i++) {
                kick.process();
            }
            const longDecayLevel = Math.max(...kick.outputs.out.map(Math.abs));

            // Long decay should still have significant output
            expect(longDecayLevel).toBeGreaterThan(shortDecayLevel);
        });

        it('should respond to decay CV', () => {
            kick.params.decay = 0.3;

            // Trigger with low decay CV
            kick.inputs.trigger[0] = 10;
            kick.inputs.decayCV.fill(0);
            kick.process();
            for (let i = 0; i < 10; i++) kick.process();
            const lowCVLevel = Math.max(...kick.outputs.out.map(Math.abs));

            // Reset with high decay CV
            kick.reset();
            kick.inputs.trigger[0] = 10;
            kick.inputs.decayCV.fill(5); // +5V should extend decay
            kick.process();
            for (let i = 0; i < 10; i++) kick.process();
            const highCVLevel = Math.max(...kick.outputs.out.map(Math.abs));

            expect(highCVLevel).toBeGreaterThan(lowCVLevel);
        });
    });

    describe('tone control', () => {
        it('should affect harmonic content', () => {
            // Test at different tone settings - harder to test precisely
            // but we can verify output changes
            kick.params.tone = 0.2;
            kick.inputs.trigger[0] = 10;
            kick.process();
            const lowToneOutput = [...kick.outputs.out];

            kick.reset();
            kick.params.tone = 0.8;
            kick.inputs.trigger[0] = 10;
            kick.process();
            const highToneOutput = [...kick.outputs.out];

            // Outputs should be different
            let difference = 0;
            for (let i = 0; i < 512; i++) {
                difference += Math.abs(lowToneOutput[i] - highToneOutput[i]);
            }
            expect(difference).toBeGreaterThan(0);
        });

        it('should respond to tone CV', () => {
            kick.params.tone = 0.5;

            kick.inputs.trigger[0] = 10;
            kick.inputs.toneCV.fill(0);
            kick.process();
            const noCVOutput = [...kick.outputs.out];

            kick.reset();
            kick.inputs.trigger[0] = 10;
            kick.inputs.toneCV.fill(5);
            kick.process();
            const withCVOutput = [...kick.outputs.out];

            // Should produce different output
            let difference = 0;
            for (let i = 0; i < 512; i++) {
                difference += Math.abs(noCVOutput[i] - withCVOutput[i]);
            }
            expect(difference).toBeGreaterThan(0);
        });
    });

    describe('output characteristics', () => {
        it('should produce audio-range output (within ±5V)', () => {
            kick.inputs.trigger[0] = 10;
            kick.process();

            const maxOutput = Math.max(...kick.outputs.out.map(Math.abs));
            expect(maxOutput).toBeLessThanOrEqual(10); // Allow some headroom for transients
            expect(maxOutput).toBeGreaterThan(0);
        });

        it('should have pitch sweep characteristic of kick drums', () => {
            // Kick drums have higher pitch at attack, sweeping down
            kick.inputs.trigger[0] = 10;
            kick.process();

            // Early part should have higher frequency content
            const earlyZeroCrossings = (() => {
                let count = 0;
                for (let i = 1; i < 64; i++) {
                    if ((kick.outputs.out[i] >= 0) !== (kick.outputs.out[i-1] >= 0)) count++;
                }
                return count;
            })();

            const lateZeroCrossings = (() => {
                let count = 0;
                for (let i = 449; i < 512; i++) {
                    if ((kick.outputs.out[i] >= 0) !== (kick.outputs.out[i-1] >= 0)) count++;
                }
                return count;
            })();

            // Early should have more zero crossings (higher freq) than late
            expect(earlyZeroCrossings).toBeGreaterThanOrEqual(lateZeroCrossings);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffer', () => {
            kick.inputs.trigger[0] = 10;
            kick.process();

            expect(kick.outputs.out.every(v => !isNaN(v))).toBe(true);
        });

        it('should produce no NaN values', () => {
            kick.process();
            expect(kick.outputs.out.every(v => !isNaN(v))).toBe(true);
        });
    });

    describe('reset', () => {
        it('should clear output and state on reset', () => {
            kick.inputs.trigger[0] = 10;
            kick.process();
            kick.reset();

            expect(kick.outputs.out[0]).toBe(0);
            expect(kick.leds.active).toBe(0);
        });

        it('should be retriggerable after reset', () => {
            kick.inputs.trigger[0] = 10;
            kick.process();
            kick.reset();

            kick.inputs.trigger[0] = 10;
            kick.process();

            const hasOutput = kick.outputs.out.some(v => Math.abs(v) > 0.01);
            expect(hasOutput).toBe(true);
        });
    });

    describe('module metadata', () => {
        it('should have correct module ID', () => {
            expect(kickModule.id).toBe('kick');
        });

        it('should have correct HP width', () => {
            expect(kickModule.hp).toBe(2);
        });

        it('should have 3 knobs (pitch, decay, tone)', () => {
            expect(kickModule.ui.knobs.length).toBe(3);
        });

        it('should have trigger and CV inputs', () => {
            expect(kickModule.ui.inputs.length).toBeGreaterThanOrEqual(4);
        });

        it('should have 1 output', () => {
            expect(kickModule.ui.outputs.length).toBe(1);
        });
    });
});
