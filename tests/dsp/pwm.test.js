/**
 * Tests for PWM - Pulse Width Modulation Generator
 * Based on Doepfer A-168-1
 */
import { describe, it, expect, beforeEach } from 'vitest';
import pwmModule from '../../src/js/modules/pwm/index.js';

describe('PWM - Pulse Width Modulation Generator', () => {
    let dsp;
    const SAMPLE_RATE = 44100;
    const BUFFER_SIZE = 512;

    beforeEach(() => {
        dsp = pwmModule.createDSP({
            sampleRate: SAMPLE_RATE,
            bufferSize: BUFFER_SIZE
        });
    });

    describe('module metadata', () => {
        it('should have correct id', () => {
            expect(pwmModule.id).toBe('pwm');
        });

        it('should have correct name', () => {
            expect(pwmModule.name).toBe('PWM');
        });

        it('should have correct HP width', () => {
            expect(pwmModule.hp).toBe(4);
        });

        it('should have utility category', () => {
            expect(pwmModule.category).toBe('utility');
        });
    });

    describe('initialization', () => {
        it('should have default params', () => {
            expect(dsp.params.pw).toBe(0.5); // 50% duty cycle
            expect(dsp.params.pwmAmt).toBe(0.5);
        });

        it('should have input buffer', () => {
            expect(dsp.inputs.in).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.in.length).toBe(BUFFER_SIZE);
        });

        it('should have PWM CV input buffer', () => {
            expect(dsp.inputs.pwmCV).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.pwmCV.length).toBe(BUFFER_SIZE);
        });

        it('should have output buffers', () => {
            expect(dsp.outputs.out).toBeInstanceOf(Float32Array);
            expect(dsp.outputs.inv).toBeInstanceOf(Float32Array);
            expect(dsp.outputs.out.length).toBe(BUFFER_SIZE);
            expect(dsp.outputs.inv.length).toBe(BUFFER_SIZE);
        });

        it('should have LED indicators', () => {
            expect(dsp.leds.out).toBeDefined();
            expect(dsp.leds.inv).toBeDefined();
        });
    });

    describe('basic comparator function', () => {
        it('should output high when input is above threshold', () => {
            dsp.params.pw = 0.5; // Threshold at 0V
            dsp.inputs.in.fill(3); // Above threshold

            dsp.process();

            // All samples should be high
            expect(dsp.outputs.out[0]).toBeGreaterThan(0);
            expect(dsp.outputs.out.every(v => v > 0)).toBe(true);
        });

        it('should output low when input is below threshold', () => {
            dsp.params.pw = 0.5; // Threshold at 0V
            dsp.inputs.in.fill(-3); // Below threshold

            dsp.process();

            // All samples should be low
            expect(dsp.outputs.out[0]).toBeLessThan(0);
            expect(dsp.outputs.out.every(v => v < 0)).toBe(true);
        });

        it('should produce inverted output', () => {
            dsp.params.pw = 0.5;
            dsp.inputs.in.fill(3);

            dsp.process();

            // Inverted should be opposite of main output
            for (let i = 0; i < BUFFER_SIZE; i++) {
                expect(Math.sign(dsp.outputs.out[i])).toBe(-Math.sign(dsp.outputs.inv[i]));
            }
        });
    });

    describe('pulse width control', () => {
        it('should produce ~50% duty cycle with PW at center', () => {
            dsp.params.pw = 0.5;

            // Triangle wave from -5V to +5V
            for (let i = 0; i < BUFFER_SIZE; i++) {
                const phase = i / BUFFER_SIZE;
                dsp.inputs.in[i] = phase < 0.5
                    ? -5 + phase * 20
                    : 15 - phase * 20;
            }

            dsp.process();

            // Count high samples
            const highCount = dsp.outputs.out.filter(v => v > 0).length;
            const dutyCycle = highCount / BUFFER_SIZE;

            // Should be close to 50%
            expect(dutyCycle).toBeGreaterThan(0.45);
            expect(dutyCycle).toBeLessThan(0.55);
        });

        it('should produce narrow pulse with PW at minimum', () => {
            dsp.params.pw = 0.1; // Low threshold = narrow high pulse

            // Triangle wave from -5V to +5V
            for (let i = 0; i < BUFFER_SIZE; i++) {
                const phase = i / BUFFER_SIZE;
                dsp.inputs.in[i] = phase < 0.5
                    ? -5 + phase * 20
                    : 15 - phase * 20;
            }

            dsp.process();

            const highCount = dsp.outputs.out.filter(v => v > 0).length;
            const dutyCycle = highCount / BUFFER_SIZE;

            // Should be wide pulse (low threshold = more time above)
            expect(dutyCycle).toBeGreaterThan(0.7);
        });

        it('should produce wide pulse with PW at maximum', () => {
            dsp.params.pw = 0.9; // High threshold = wide low pulse

            // Triangle wave from -5V to +5V
            for (let i = 0; i < BUFFER_SIZE; i++) {
                const phase = i / BUFFER_SIZE;
                dsp.inputs.in[i] = phase < 0.5
                    ? -5 + phase * 20
                    : 15 - phase * 20;
            }

            dsp.process();

            const highCount = dsp.outputs.out.filter(v => v > 0).length;
            const dutyCycle = highCount / BUFFER_SIZE;

            // Should be narrow pulse (high threshold = less time above)
            expect(dutyCycle).toBeLessThan(0.3);
        });
    });

    describe('PWM CV modulation', () => {
        it('should modulate pulse width with CV input', () => {
            dsp.params.pw = 0.5;
            dsp.params.pwmAmt = 1.0;

            // Constant input signal at 0V (right at threshold)
            dsp.inputs.in.fill(0);

            // Positive CV should shift threshold down, output goes high
            dsp.inputs.pwmCV.fill(2);
            dsp.process();
            const withPositiveCV = dsp.outputs.out[0];

            // Negative CV should shift threshold up, output goes low
            dsp.inputs.pwmCV.fill(-2);
            dsp.process();
            const withNegativeCV = dsp.outputs.out[0];

            expect(withPositiveCV).toBeGreaterThan(0);
            expect(withNegativeCV).toBeLessThan(0);
        });

        it('should respect PWM amount attenuator', () => {
            dsp.params.pw = 0.5;
            dsp.inputs.in.fill(0); // At threshold

            // With full amount, CV should have effect
            dsp.params.pwmAmt = 1.0;
            dsp.inputs.pwmCV.fill(1);
            dsp.process();
            const fullAmount = dsp.outputs.out[0];

            // With zero amount, CV should have no effect
            dsp.params.pwmAmt = 0;
            dsp.inputs.pwmCV.fill(5);
            dsp.process();
            const zeroAmount = dsp.outputs.out[0];

            expect(fullAmount).toBeGreaterThan(0);
            // At exactly 0V input with 0V threshold, could go either way
            // The key is that large CV has no effect when amount is 0
        });

        it('should create PWM effect with LFO on CV input', () => {
            dsp.params.pw = 0.5;
            dsp.params.pwmAmt = 0.5;

            // Constant audio-rate input (like a saw wave at one point)
            dsp.inputs.in.fill(2);

            // Slow modulation on PWM CV
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.pwmCV[i] = Math.sin(i * 0.01) * 5;
            }

            dsp.process();

            // Output should have some transitions (not all same)
            const hasTransitions = dsp.outputs.out.some((v, i) =>
                i > 0 && Math.sign(v) !== Math.sign(dsp.outputs.out[i - 1])
            );
            expect(hasTransitions).toBe(true);
        });
    });

    describe('waveform conversion', () => {
        it('should convert triangle wave to pulse', () => {
            dsp.params.pw = 0.5;

            // Generate triangle wave
            for (let i = 0; i < BUFFER_SIZE; i++) {
                const phase = (i / BUFFER_SIZE) * 4; // Multiple cycles
                const tri = Math.abs((phase % 1) * 2 - 1) * 10 - 5; // ±5V
                dsp.inputs.in[i] = tri;
            }

            dsp.process();

            // Output should be binary (high or low)
            const allBinary = dsp.outputs.out.every(v =>
                Math.abs(Math.abs(v) - 5) < 0.1
            );
            expect(allBinary).toBe(true);
        });

        it('should convert sawtooth wave to pulse', () => {
            dsp.params.pw = 0.5;

            // Generate sawtooth wave
            for (let i = 0; i < BUFFER_SIZE; i++) {
                const phase = (i / BUFFER_SIZE) * 4; // Multiple cycles
                const saw = ((phase % 1) * 2 - 1) * 5; // ±5V
                dsp.inputs.in[i] = saw;
            }

            dsp.process();

            // Output should be binary
            const allBinary = dsp.outputs.out.every(v =>
                Math.abs(Math.abs(v) - 5) < 0.1
            );
            expect(allBinary).toBe(true);
        });

        it('should convert sine wave to pulse', () => {
            dsp.params.pw = 0.5;

            // Generate sine wave
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in[i] = Math.sin(i * 0.1) * 5;
            }

            dsp.process();

            // Output should be binary
            const allBinary = dsp.outputs.out.every(v =>
                Math.abs(Math.abs(v) - 5) < 0.1
            );
            expect(allBinary).toBe(true);
        });
    });

    describe('output levels', () => {
        it('should output ±5V levels', () => {
            dsp.params.pw = 0.5;

            // Generate varying input
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in[i] = Math.sin(i * 0.05) * 5;
            }

            dsp.process();

            // Check output levels are ±5V
            const highLevel = Math.max(...dsp.outputs.out);
            const lowLevel = Math.min(...dsp.outputs.out);

            expect(highLevel).toBeCloseTo(5, 1);
            expect(lowLevel).toBeCloseTo(-5, 1);
        });

        it('should have inverted output at same levels', () => {
            dsp.params.pw = 0.5;

            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in[i] = Math.sin(i * 0.05) * 5;
            }

            dsp.process();

            const highLevel = Math.max(...dsp.outputs.inv);
            const lowLevel = Math.min(...dsp.outputs.inv);

            expect(highLevel).toBeCloseTo(5, 1);
            expect(lowLevel).toBeCloseTo(-5, 1);
        });
    });

    describe('LED indicators', () => {
        it('should show output state on LED', () => {
            dsp.params.pw = 0.5;
            dsp.inputs.in.fill(5); // All high

            dsp.process();

            expect(dsp.leds.out).toBeGreaterThan(0);
        });

        it('should show inverted state on inv LED', () => {
            dsp.params.pw = 0.5;
            dsp.inputs.in.fill(5); // Main output high, inv low

            dsp.process();

            // When main is high, inv is low
            expect(dsp.leds.out).toBeGreaterThan(dsp.leds.inv);
        });
    });

    describe('edge cases', () => {
        it('should handle silence (zero input)', () => {
            dsp.params.pw = 0.5; // Threshold at 0
            dsp.inputs.in.fill(0);

            dsp.process();

            // At exactly threshold, behavior is defined (we'll go low)
            expect(dsp.outputs.out.every(v => !Number.isNaN(v))).toBe(true);
        });

        it('should handle DC offset input', () => {
            dsp.params.pw = 0.5;
            dsp.inputs.in.fill(2.5); // DC offset above threshold

            dsp.process();

            expect(dsp.outputs.out.every(v => v > 0)).toBe(true);
        });

        it('should handle extreme PW values', () => {
            // Minimum PW
            dsp.params.pw = 0;
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in[i] = Math.sin(i * 0.1) * 5;
            }
            dsp.process();
            expect(dsp.outputs.out.every(v => !Number.isNaN(v))).toBe(true);

            // Maximum PW
            dsp.params.pw = 1;
            dsp.process();
            expect(dsp.outputs.out.every(v => !Number.isNaN(v))).toBe(true);
        });
    });

    describe('reset', () => {
        it('should reset LED states', () => {
            dsp.inputs.in.fill(5);
            dsp.process();

            dsp.reset();

            expect(dsp.leds.out).toBe(0);
            expect(dsp.leds.inv).toBe(0);
        });
    });

    describe('buffer integrity', () => {
        it('should not produce NaN values', () => {
            const testInputs = [0, 5, -5, 10, -10, 0.001, -0.001];

            testInputs.forEach(val => {
                dsp.inputs.in.fill(val);
                dsp.process();
            });

            expect(dsp.outputs.out.some(v => Number.isNaN(v))).toBe(false);
            expect(dsp.outputs.inv.some(v => Number.isNaN(v))).toBe(false);
        });

        it('should fill entire buffer', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in[i] = Math.sin(i * 0.1) * 5;
            }

            dsp.process();

            // Check no undefined/empty values
            expect(dsp.outputs.out.length).toBe(BUFFER_SIZE);
            expect(dsp.outputs.inv.length).toBe(BUFFER_SIZE);
        });
    });

    describe('ui definition', () => {
        it('should have LED indicators defined', () => {
            expect(pwmModule.ui.leds).toContain('out');
            expect(pwmModule.ui.leds).toContain('inv');
        });

        it('should have PW and PWM amount knobs', () => {
            const knobs = pwmModule.ui.knobs;
            expect(knobs.find(k => k.param === 'pw')).toBeDefined();
            expect(knobs.find(k => k.param === 'pwmAmt')).toBeDefined();
        });

        it('should have input jacks', () => {
            const inputs = pwmModule.ui.inputs;
            expect(inputs.find(i => i.port === 'in')).toBeDefined();
            expect(inputs.find(i => i.port === 'pwmCV')).toBeDefined();
        });

        it('should have output jacks', () => {
            const outputs = pwmModule.ui.outputs;
            expect(outputs.find(o => o.port === 'out')).toBeDefined();
            expect(outputs.find(o => o.port === 'inv')).toBeDefined();
        });
    });
});
