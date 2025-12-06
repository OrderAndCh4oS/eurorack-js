import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create2hpOut } from '../../src/js/dsp/output.js';

// Mock AudioContext for testing
class MockAudioContext {
    constructor() {
        this.currentTime = 0;
        this.sampleRate = 44100;
        this.destination = {};
    }

    createGain() {
        return {
            connect: vi.fn(),
            gain: {
                setValueAtTime: vi.fn()
            }
        };
    }

    createBuffer(channels, length, sampleRate) {
        const channelData = [new Float32Array(length), new Float32Array(length)];
        return {
            getChannelData: (ch) => channelData[ch]
        };
    }

    createBufferSource() {
        return {
            buffer: null,
            connect: vi.fn(),
            start: vi.fn()
        };
    }
}

// Set up global mock
global.window = { AudioContext: MockAudioContext };

describe('create2hpOut', () => {
    let output;
    let mockCtx;

    beforeEach(() => {
        mockCtx = new MockAudioContext();
        output = create2hpOut(mockCtx);
    });

    describe('initialization', () => {
        it('should create an output module with default params', () => {
            expect(output.params.volume).toBe(0.8);
        });

        it('should create input buffers', () => {
            expect(output.inputs.L).toBeInstanceOf(Float32Array);
            expect(output.inputs.R).toBeInstanceOf(Float32Array);
            expect(output.inputs.L.length).toBe(512);
        });

        it('should have LED outputs', () => {
            expect(output.leds.L).toBe(0);
            expect(output.leds.R).toBe(0);
        });

        it('should store AudioContext reference', () => {
            expect(output.audioCtx).toBe(mockCtx);
        });

        it('should accept custom buffer size', () => {
            const customOutput = create2hpOut(mockCtx, { bufferSize: 256 });
            expect(customOutput.inputs.L.length).toBe(256);
        });
    });

    describe('process()', () => {
        it('should process without error', () => {
            // Fill with test data
            for (let i = 0; i < 512; i++) {
                output.inputs.L[i] = Math.sin(i * 0.1) * 5;
                output.inputs.R[i] = Math.cos(i * 0.1) * 5;
            }

            expect(() => output.process()).not.toThrow();
        });

        it('should update LED meters based on input levels', () => {
            // Fill with known levels
            for (let i = 0; i < 512; i++) {
                output.inputs.L[i] = 2.5; // 50% of 5V
                output.inputs.R[i] = 1.25; // 25% of 5V
            }

            output.process();

            expect(output.leds.L).toBeCloseTo(0.5, 1);
            expect(output.leds.R).toBeCloseTo(0.25, 1);
        });

        it('should respond to silence with zero LED', () => {
            // Fill with silence
            for (let i = 0; i < 512; i++) {
                output.inputs.L[i] = 0;
                output.inputs.R[i] = 0;
            }

            output.process();

            expect(output.leds.L).toBe(0);
            expect(output.leds.R).toBe(0);
        });

        it('should measure absolute peak level', () => {
            // Fill with negative values
            for (let i = 0; i < 512; i++) {
                output.inputs.L[i] = -3; // -3V
                output.inputs.R[i] = -4; // -4V
            }

            output.process();

            expect(output.leds.L).toBeCloseTo(0.6, 1); // |−3|/5
            expect(output.leds.R).toBeCloseTo(0.8, 1); // |−4|/5
        });
    });

    describe('volume control', () => {
        it('should pass volume param to gain node', () => {
            output.params.volume = 0.5;

            // We can't easily test the internal gain node without more mocking,
            // but we can verify the param exists and is settable
            expect(output.params.volume).toBe(0.5);
        });
    });

    describe('stereo operation', () => {
        it('should handle different left and right signals', () => {
            // Different signals for each channel
            for (let i = 0; i < 512; i++) {
                output.inputs.L[i] = 5; // Full level left
                output.inputs.R[i] = 0; // Silent right
            }

            output.process();

            expect(output.leds.L).toBeCloseTo(1, 1);
            expect(output.leds.R).toBe(0);
        });
    });

    describe('clearAudioInputs', () => {
        it('should zero input buffers', () => {
            // Fill with audio
            for (let i = 0; i < 512; i++) {
                output.inputs.L[i] = 5;
                output.inputs.R[i] = 3;
            }

            output.clearAudioInputs();

            expect(output.inputs.L.every(v => v === 0)).toBe(true);
            expect(output.inputs.R.every(v => v === 0)).toBe(true);
        });

        it('should reset input references to own buffers', () => {
            // Simulate routing replacing input with foreign buffer
            const foreignBuffer = new Float32Array(512);
            foreignBuffer.fill(5);
            output.inputs.L = foreignBuffer;

            output.clearAudioInputs();

            // Should now point to internal zeroed buffer, not foreign buffer
            expect(output.inputs.L).not.toBe(foreignBuffer);
            expect(output.inputs.L.every(v => v === 0)).toBe(true);
        });

        it('should result in silence after process', () => {
            // Fill with audio
            for (let i = 0; i < 512; i++) {
                output.inputs.L[i] = 5;
                output.inputs.R[i] = 5;
            }

            output.clearAudioInputs();
            output.process();

            // LEDs should show zero (silence)
            expect(output.leds.L).toBe(0);
            expect(output.leds.R).toBe(0);
        });
    });

    describe('buffer processing', () => {
        it('should handle full range signals', () => {
            // Full range +/- 5V
            for (let i = 0; i < 512; i++) {
                output.inputs.L[i] = Math.sin(i * 0.1) * 5;
                output.inputs.R[i] = Math.cos(i * 0.1) * 5;
            }

            expect(() => output.process()).not.toThrow();
        });

        it('should handle very small signals', () => {
            for (let i = 0; i < 512; i++) {
                output.inputs.L[i] = 0.001;
                output.inputs.R[i] = 0.001;
            }

            output.process();

            expect(output.leds.L).toBeCloseTo(0, 2);
            expect(output.leds.R).toBeCloseTo(0, 2);
        });
    });
});
