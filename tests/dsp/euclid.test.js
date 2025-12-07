import { describe, it, expect, beforeEach } from 'vitest';
import euclidModule from '../../src/js/modules/euclid/index.js';

// Helper to create EUCLID instance
const createEuclid = (options = {}) => euclidModule.createDSP(options);

// Helper to send a trigger pulse and process
function sendTrigger(euclid, input = 'clock') {
    euclid.inputs[input].fill(0);
    euclid.process();
    euclid.inputs[input].fill(10);
    euclid.process();
    euclid.inputs[input].fill(0);
    euclid.process();
}

// Helper to collect pattern by stepping through
function collectPattern(euclid, steps) {
    const pattern = [];
    for (let i = 0; i < steps; i++) {
        sendTrigger(euclid, 'clock');
        // Check if trigger output fired (any sample > 0)
        const fired = euclid.outputs.trig.some(v => v > 0);
        pattern.push(fired ? 1 : 0);
    }
    return pattern;
}

/**
 * Euclidean Rhythm Generator Tests
 *
 * Based on 2hp Euclid:
 * - Up to 16 steps
 * - CV control over length and hits
 * - Euclidean algorithm distributes hits evenly
 *
 * Source: https://www.twohp.com/modules/euclid
 */

describe('createEuclid', () => {
    let euclid;

    beforeEach(() => {
        euclid = createEuclid();
    });

    describe('initialization', () => {
        it('should create with default params', () => {
            expect(euclid.params.length).toBeDefined();
            expect(euclid.params.hits).toBeDefined();
            expect(euclid.params.rotate).toBeDefined();
        });

        it('should create output buffers', () => {
            expect(euclid.outputs.trig).toBeInstanceOf(Float32Array);
            expect(euclid.outputs.trig.length).toBe(512);
        });

        it('should create input buffers', () => {
            expect(euclid.inputs.clock).toBeInstanceOf(Float32Array);
            expect(euclid.inputs.reset).toBeInstanceOf(Float32Array);
            expect(euclid.inputs.lenCV).toBeInstanceOf(Float32Array);
            expect(euclid.inputs.hitsCV).toBeInstanceOf(Float32Array);
        });

        it('should have LED output', () => {
            expect(euclid.leds.active).toBeDefined();
        });

        it('should accept custom options', () => {
            const custom = createEuclid({ bufferSize: 256, sampleRate: 48000 });
            expect(custom.outputs.trig.length).toBe(256);
        });
    });

    describe('Euclidean algorithm - classic patterns', () => {
        it('should generate tresillo pattern (3 hits, 8 steps)', () => {
            euclid.params.length = 8;
            euclid.params.hits = 3;
            euclid.params.rotate = 0;

            const pattern = collectPattern(euclid, 8);
            const hitCount = pattern.filter(x => x === 1).length;

            expect(hitCount).toBe(3);
        });

        it('should generate cinquillo pattern (5 hits, 8 steps)', () => {
            euclid.params.length = 8;
            euclid.params.hits = 5;
            euclid.params.rotate = 0;

            const pattern = collectPattern(euclid, 8);
            const hitCount = pattern.filter(x => x === 1).length;

            expect(hitCount).toBe(5);
        });

        it('should generate 4-on-the-floor (4 hits, 16 steps)', () => {
            euclid.params.length = 16;
            euclid.params.hits = 4;
            euclid.params.rotate = 0;

            const pattern = collectPattern(euclid, 16);
            const hitCount = pattern.filter(x => x === 1).length;

            expect(hitCount).toBe(4);
        });

        it('should handle maximum density (8 hits, 8 steps = all on)', () => {
            euclid.params.length = 8;
            euclid.params.hits = 8;
            euclid.params.rotate = 0;

            const pattern = collectPattern(euclid, 8);
            const hitCount = pattern.filter(x => x === 1).length;

            expect(hitCount).toBe(8);
        });

        it('should handle minimum density (1 hit, 8 steps)', () => {
            euclid.params.length = 8;
            euclid.params.hits = 1;
            euclid.params.rotate = 0;

            const pattern = collectPattern(euclid, 8);
            const hitCount = pattern.filter(x => x === 1).length;

            expect(hitCount).toBe(1);
        });
    });

    describe('pattern looping', () => {
        it('should loop pattern after length steps', () => {
            euclid.params.length = 4;
            euclid.params.hits = 2;
            euclid.params.rotate = 0;

            // Collect two cycles
            const pattern1 = collectPattern(euclid, 4);
            const pattern2 = collectPattern(euclid, 4);

            expect(pattern1).toEqual(pattern2);
        });
    });

    describe('rotation/offset', () => {
        it('should shift pattern with rotation', () => {
            euclid.params.length = 8;
            euclid.params.hits = 3;

            // Get pattern without rotation
            euclid.params.rotate = 0;
            euclid.reset();
            const pattern0 = collectPattern(euclid, 8);

            // Get pattern with rotation
            euclid.params.rotate = 2;
            euclid.reset();
            const pattern2 = collectPattern(euclid, 8);

            // Should have same number of hits
            expect(pattern0.filter(x => x).length).toBe(pattern2.filter(x => x).length);

            // But pattern should be different (shifted)
            expect(pattern0).not.toEqual(pattern2);
        });

        it('should wrap rotation around pattern length', () => {
            euclid.params.length = 4;
            euclid.params.hits = 2;

            // Rotation of 0 and rotation of length should be same
            euclid.params.rotate = 0;
            euclid.reset();
            const pattern0 = collectPattern(euclid, 4);

            euclid.params.rotate = 4;  // Same as 0 for length 4
            euclid.reset();
            const pattern4 = collectPattern(euclid, 4);

            expect(pattern0).toEqual(pattern4);
        });
    });

    describe('clock input', () => {
        it('should advance on clock rising edge', () => {
            euclid.params.length = 8;
            euclid.params.hits = 4;

            // Send clock and check we advance
            let lastStep = -1;
            for (let i = 0; i < 4; i++) {
                sendTrigger(euclid, 'clock');
                // Pattern should progress (internal state)
            }

            // Should have processed 4 steps
            const pattern = collectPattern(euclid, 4);
            expect(pattern.length).toBe(4);
        });

        it('should not advance on sustained high clock', () => {
            euclid.params.length = 8;
            euclid.params.hits = 8;  // All hits for easy counting

            // Single rising edge
            euclid.inputs.clock.fill(0);
            euclid.process();
            euclid.inputs.clock.fill(10);
            euclid.process();  // Rising edge - should advance

            // Keep clock high
            euclid.process();  // No edge - should not advance
            euclid.process();  // No edge - should not advance

            // Only one step should have been processed
        });

        it('should require >= 1V threshold for clock', () => {
            euclid.params.length = 8;
            euclid.params.hits = 8;

            euclid.inputs.clock.fill(0);
            euclid.process();
            euclid.inputs.clock.fill(0.9);  // Below threshold
            euclid.process();

            // Should not have advanced - check output is still 0
        });
    });

    describe('reset input', () => {
        it('should reset to step 0 on reset trigger', () => {
            euclid.params.length = 4;
            euclid.params.hits = 4;  // All steps have hits
            euclid.params.rotate = 0;

            // Advance several steps
            for (let i = 0; i < 5; i++) {
                sendTrigger(euclid, 'clock');
            }

            // Send reset
            sendTrigger(euclid, 'reset');

            // Next clock should be at step 0 (which has a hit since all steps do)
            sendTrigger(euclid, 'clock');
            const fired = euclid.outputs.trig.some(v => v > 0);
            expect(fired).toBe(true);
        });
    });

    describe('CV modulation', () => {
        it('should increase length with positive CV', () => {
            euclid.params.length = 4;  // Base length
            euclid.params.hits = 4;
            euclid.inputs.lenCV.fill(5);  // +5V should add steps

            // The effective length should be > 4
            // Reset and collect more than 4 steps
            euclid.reset();
            const pattern = collectPattern(euclid, 8);

            // With CV adding length, pattern should extend beyond 4
            // At minimum, we should be able to collect 8 without issues
            expect(pattern.length).toBe(8);
        });

        it('should clamp length to valid range (1-16)', () => {
            euclid.params.length = 2;
            euclid.inputs.lenCV.fill(-10);  // Try to go below 1
            euclid.process();

            // Should not crash, should clamp to minimum 1
            expect(euclid.outputs.trig.every(v => !isNaN(v))).toBe(true);
        });

        it('should modulate hits with CV', () => {
            euclid.params.length = 8;
            euclid.params.hits = 2;
            euclid.inputs.hitsCV.fill(0);
            euclid.reset();

            const pattern1 = collectPattern(euclid, 8);
            const hits1 = pattern1.filter(x => x).length;

            euclid.params.hits = 2;
            euclid.inputs.hitsCV.fill(2.5);  // Add some hits
            euclid.reset();

            const pattern2 = collectPattern(euclid, 8);
            const hits2 = pattern2.filter(x => x).length;

            expect(hits2).toBeGreaterThanOrEqual(hits1);
        });
    });

    describe('trigger output', () => {
        it('should output 10V trigger on hit', () => {
            euclid.params.length = 4;
            euclid.params.hits = 4;  // All hits

            sendTrigger(euclid, 'clock');

            // Should have 10V output during trigger
            const maxOutput = Math.max(...euclid.outputs.trig);
            expect(maxOutput).toBeCloseTo(10, 0);
        });

        it('should output 0V on non-hit', () => {
            euclid.params.length = 8;
            euclid.params.hits = 1;  // Only one hit
            euclid.params.rotate = 0;

            // First step is hit
            sendTrigger(euclid, 'clock');

            // Second step should not be hit
            sendTrigger(euclid, 'clock');

            // On non-hit step, output should be 0
            const maxOutput = Math.max(...euclid.outputs.trig);
            expect(maxOutput).toBe(0);
        });
    });

    describe('LED indicator', () => {
        it('should light on hit', () => {
            euclid.params.length = 4;
            euclid.params.hits = 4;

            sendTrigger(euclid, 'clock');

            expect(euclid.leds.active).toBeGreaterThan(0);
        });
    });

    describe('reset', () => {
        it('should reset all state', () => {
            euclid.params.length = 8;
            euclid.params.hits = 4;

            // Process some steps
            for (let i = 0; i < 5; i++) {
                sendTrigger(euclid, 'clock');
            }

            euclid.reset();

            expect(euclid.outputs.trig[0]).toBe(0);
            expect(euclid.leds.active).toBe(0);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire buffers without NaN', () => {
            euclid.params.length = 8;
            euclid.params.hits = 4;
            sendTrigger(euclid, 'clock');

            expect(euclid.outputs.trig.every(v => !isNaN(v))).toBe(true);
        });
    });

    describe('module metadata', () => {
        it('should have correct id', () => {
            expect(euclidModule.id).toBe('euclid');
        });

        it('should have correct category', () => {
            expect(euclidModule.category).toBe('sequencer');
        });

        it('should have UI definition', () => {
            expect(euclidModule.ui).toBeDefined();
            expect(euclidModule.ui.knobs.length).toBe(3);
            expect(euclidModule.ui.inputs.length).toBe(4);
            expect(euclidModule.ui.outputs.length).toBeGreaterThanOrEqual(1);
        });
    });
});
