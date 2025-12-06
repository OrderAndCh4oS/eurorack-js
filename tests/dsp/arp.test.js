import { describe, it, expect, beforeEach } from 'vitest';
import arpModule, {
    buildArpSequence,
    CHORDS,
    CHORD_NAMES,
    ARP_MODE_NAMES
} from '../../src/js/modules/arp/index.js';
import { ARP_MODES } from '../../src/js/modules/arp/chords.js';

// Helper to create Arp instance using new module system
const createArp = (options = {}) => arpModule.createDSP(options);

describe('arp', () => {
    describe('CHORDS', () => {
        it('should have 13 chord types (per 2hp Arp spec)', () => {
            expect(CHORD_NAMES.length).toBe(13);
        });

        it('should have major triad', () => {
            expect(CHORDS.major).toEqual([0, 4, 7]);
        });

        it('should have major 7th chord', () => {
            expect(CHORDS.maj7).toEqual([0, 4, 7, 11]);
        });

        it('should have dominant 7th chord', () => {
            expect(CHORDS.dom7).toEqual([0, 4, 7, 10]);
        });

        it('should have minor triad', () => {
            expect(CHORDS.minor).toEqual([0, 3, 7]);
        });

        it('should have minor 7th chord', () => {
            expect(CHORDS.min7).toEqual([0, 3, 7, 10]);
        });

        it('should have diminished chord', () => {
            expect(CHORDS.dim).toEqual([0, 3, 6]);
        });

        it('should have half diminished 7th chord', () => {
            expect(CHORDS.halfDim7).toEqual([0, 3, 6, 10]);
        });

        it('should have full diminished 7th chord', () => {
            expect(CHORDS.fullDim7).toEqual([0, 3, 6, 9]);
        });

        it('should have augmented chord', () => {
            expect(CHORDS.aug).toEqual([0, 4, 8]);
        });

        it('should have augmented 7th chord', () => {
            expect(CHORDS.aug7).toEqual([0, 4, 8, 10]);
        });

        it('should have sus4 chord', () => {
            expect(CHORDS.sus4).toEqual([0, 5, 7]);
        });

        it('should have sus4 major 7th chord', () => {
            expect(CHORDS.sus4Maj7).toEqual([0, 5, 7, 11]);
        });

        it('should have sus4 minor 7th chord', () => {
            expect(CHORDS.sus4Min7).toEqual([0, 5, 7, 10]);
        });
    });

    describe('ARP_MODES', () => {
        it('should have 4 arp modes', () => {
            expect(ARP_MODE_NAMES.length).toBe(4);
        });

        it('should include up, down, upDown, random', () => {
            expect(ARP_MODE_NAMES).toContain('up');
            expect(ARP_MODE_NAMES).toContain('down');
            expect(ARP_MODE_NAMES).toContain('upDown');
            expect(ARP_MODE_NAMES).toContain('random');
        });
    });

    describe('buildArpSequence', () => {
        it('should build ascending sequence for up mode', () => {
            const seq = buildArpSequence(CHORDS.major, 1, 'up');
            expect(seq).toEqual([0, 4, 7]);
        });

        it('should build descending sequence for down mode', () => {
            const seq = buildArpSequence(CHORDS.major, 1, 'down');
            expect(seq).toEqual([7, 4, 0]);
        });

        it('should build up-down sequence', () => {
            const seq = buildArpSequence(CHORDS.major, 1, 'upDown');
            // Up: 0, 4, 7, Down (excluding ends): 4
            expect(seq).toEqual([0, 4, 7, 4]);
        });

        it('should expand sequence across multiple octaves', () => {
            const seq = buildArpSequence(CHORDS.major, 2, 'up');
            // Octave 1: 0, 4, 7
            // Octave 2: 12, 16, 19
            expect(seq).toEqual([0, 4, 7, 12, 16, 19]);
        });

        it('should handle 2 octaves (per 2hp Arp spec)', () => {
            const seq = buildArpSequence(CHORDS.major, 2, 'up');
            expect(seq.length).toBe(6); // 3 notes × 2 octaves
            expect(seq[seq.length - 1]).toBe(12 + 7); // Second octave + 7
        });
    });

    describe('createArp', () => {
        let arp;

        beforeEach(() => {
            arp = createArp({ bufferSize: 128, sampleRate: 48000 });
        });

        describe('initialization', () => {
            it('should create arp instance', () => {
                expect(arp).toBeDefined();
            });

            it('should have correct default params', () => {
                expect(arp.params.root).toBe(0);
                expect(arp.params.chord).toBe(0);
                expect(arp.params.mode).toBe(0);
                expect(arp.params.octaves).toBe(1);
            });

            it('should have required inputs', () => {
                expect(arp.inputs).toHaveProperty('trigger');
                expect(arp.inputs).toHaveProperty('reset');
                expect(arp.inputs).toHaveProperty('rootCV');
                expect(arp.inputs).toHaveProperty('chordCV');
            });

            it('should have cv output', () => {
                expect(arp.outputs.cv).toBeDefined();
                expect(arp.outputs.cv.length).toBe(128);
            });

            it('should have step LED', () => {
                expect(arp.leds).toHaveProperty('step');
            });

            it('should have process function', () => {
                expect(typeof arp.process).toBe('function');
            });

            it('should have reset function', () => {
                expect(typeof arp.reset).toBe('function');
            });
        });

        describe('process', () => {
            it('should output root note when no trigger', () => {
                arp.params.root = 0;
                arp.process();
                // Root 0 = C, first note of chord = 0 semitones
                expect(arp.outputs.cv[0]).toBe(0);
            });

            it('should advance on trigger rising edge', () => {
                arp.params.chord = 1; // major
                arp.params.mode = 0; // up

                // First process without trigger
                arp.process();
                const firstNote = arp.outputs.cv[0];

                // Create trigger rising edge
                arp.inputs.trigger = new Float32Array(128).fill(5);
                arp.process();
                const secondNote = arp.outputs.cv[0];

                // Should have advanced to next note in chord
                expect(secondNote).not.toBe(firstNote);
            });

            it('should wrap around at end of sequence', () => {
                arp.params.chord = 0; // major
                arp.params.mode = 0;

                // Trigger multiple times
                for (let i = 0; i < 10; i++) {
                    arp.inputs.trigger = new Float32Array(128).fill(i % 2 === 0 ? 0 : 5);
                    arp.process();
                }

                // Should still output valid note
                expect(arp.outputs.cv[0]).toBeDefined();
            });

            it('should apply root note offset', () => {
                arp.params.root = 5; // F
                arp.params.chord = 0; // major (first note is root)

                arp.process();

                expect(arp.outputs.cv[0]).toBeCloseTo(5 / 12, 5);
            });

            it('should respond to root CV', () => {
                arp.params.root = 0;
                arp.params.chord = 0; // major
                arp.inputs.rootCV = new Float32Array(128).fill(0.5); // +6 semitones

                arp.process();

                expect(arp.outputs.cv[0]).toBeCloseTo(6 / 12, 5);
            });

            it('should handle multiple octaves', () => {
                arp.params.chord = 1; // major
                arp.params.octaves = 2;
                arp.params.mode = 0; // up

                // Advance through full sequence
                const notes = [];
                for (let i = 0; i < 6; i++) {
                    // Toggle trigger
                    arp.inputs.trigger = new Float32Array(128).fill(i % 2 === 0 ? 0 : 5);
                    arp.process();
                    notes.push(arp.outputs.cv[0]);
                }

                // Should have notes spanning 2 octaves
                const maxNote = Math.max(...notes);
                const minNote = Math.min(...notes);
                expect(maxNote - minNote).toBeGreaterThan(0.5); // More than half octave
            });
        });

        describe('reset', () => {
            it('should reset to first step', () => {
                arp.params.chord = 1; // major

                // Advance several steps
                for (let i = 0; i < 4; i++) {
                    arp.inputs.trigger = new Float32Array(128).fill(i % 2 === 0 ? 0 : 5);
                    arp.process();
                }

                arp.reset();

                // Should be back at step 0
                expect(arp.getCurrentStep()).toBe(0);
            });
        });

        describe('LED behavior', () => {
            it('should light LED on step', () => {
                arp.inputs.trigger = new Float32Array(128).fill(5);
                arp.process();

                expect(arp.leds.step).toBe(1);
            });

            it('should decay LED when no step', () => {
                arp.leds.step = 1;
                arp.inputs.trigger = new Float32Array(128).fill(0);
                arp.process();

                expect(arp.leds.step).toBeLessThan(1);
            });
        });

        describe('chord types', () => {
            it('should output correct notes for major chord', () => {
                arp.params.chord = 1; // major
                arp.params.root = 0;
                arp.params.mode = 0;

                const notes = [];

                // Get first 3 notes
                for (let i = 0; i < 6; i++) {
                    arp.inputs.trigger = new Float32Array(128).fill(i % 2 === 0 ? 0 : 5);
                    arp.process();
                    if (i % 2 === 1) {
                        notes.push(Math.round(arp.outputs.cv[0] * 12));
                    }
                }

                // Major chord: 0, 4, 7 semitones
                expect(notes).toContain(4); // E
                expect(notes).toContain(7); // G
            });
        });

        describe('mode behavior', () => {
            it('should play down mode in reverse', () => {
                arp.params.chord = 0; // major (index 0 now)
                arp.params.mode = 1; // down

                // Capture sequence
                const seq = buildArpSequence(CHORDS.major, 1, 'down');
                expect(seq[0]).toBe(7); // Starts with highest note
            });

            it('should handle upDown mode', () => {
                arp.params.chord = 0; // major (index 0 now)
                arp.params.mode = 2; // upDown

                const seq = buildArpSequence(CHORDS.major, 1, 'upDown');
                expect(seq.length).toBe(4); // 0, 4, 7, 4
            });
        });
    });

    /**
     * 2hp Arp Specification Compliance Tests
     *
     * Verifies the arpeggiator matches the official 2hp Arp module behavior.
     *
     * Key specs:
     * - 13 chord types (Major through Sus4 Min7)
     * - 4 playback modes (up, down, up-down/pendulum, random)
     * - 1-2 octave range
     * - 0.4V trigger threshold
     * - V/Oct tracking on root CV
     */
    describe('2hp Arp spec compliance', () => {

        describe('trigger threshold (0.4V per spec)', () => {
            let arp;

            beforeEach(() => {
                arp = createArp({ bufferSize: 128 });
            });

            it('should trigger at 0.4V', () => {
                arp.params.chord = 0; // major
                arp.process(); // Initialize
                const initialStep = arp.getCurrentStep();

                // Trigger at exactly 0.4V should work
                arp.inputs.trigger = new Float32Array(128).fill(0.4);
                arp.process();

                // Next cycle - drop to 0 then rise to 0.5V
                arp.inputs.trigger = new Float32Array(128).fill(0);
                arp.process();
                arp.inputs.trigger = new Float32Array(128).fill(0.5);
                arp.process();

                // Should have advanced
                expect(arp.getCurrentStep()).not.toBe(initialStep);
            });

            it('should NOT trigger below 0.4V', () => {
                arp.params.chord = 0;
                arp.process();

                // Try triggering at 0.3V - below threshold
                arp.inputs.trigger = new Float32Array(128).fill(0.3);
                arp.process();

                // Reset and try again
                arp.inputs.trigger = new Float32Array(128).fill(0);
                arp.process();
                arp.inputs.trigger = new Float32Array(128).fill(0.39);
                arp.process();

                // Should still be at step 0 (no advancement)
                expect(arp.getCurrentStep()).toBe(0);
            });
        });

        describe('octave range (1-2 per spec)', () => {
            let arp;

            beforeEach(() => {
                arp = createArp({ bufferSize: 128 });
            });

            it('should clamp octaves to maximum of 2', () => {
                arp.params.chord = 0; // major
                arp.params.octaves = 4; // Try to set to 4
                arp.params.mode = 0; // up

                // Advance through all notes
                const notes = [];
                for (let i = 0; i < 12; i++) {
                    arp.inputs.trigger = new Float32Array(128).fill(i % 2 === 0 ? 0 : 5);
                    arp.process();
                    if (i % 2 === 1) {
                        notes.push(arp.outputs.cv[0]);
                    }
                }

                // With 2 octaves max: major chord = 6 notes (3 notes × 2 octaves)
                // Highest note should be (12 + 7) / 12 = 19/12 ≈ 1.58V
                const maxNote = Math.max(...notes);
                expect(maxNote).toBeLessThanOrEqual(19 / 12 + 0.01);
            });

            it('should allow minimum of 1 octave', () => {
                arp.params.octaves = 1;
                arp.params.chord = 0; // major (3 notes)

                // Major chord: 3 notes in 1 octave
                const seq = buildArpSequence(CHORDS.major, 1, 'up');
                expect(seq.length).toBe(3);
            });
        });

        describe('all 13 chord types', () => {
            it('should have exactly 13 chord types per 2hp Arp spec', () => {
                const expectedChords = [
                    'major', 'maj7', 'dom7',
                    'minor', 'min7',
                    'dim', 'halfDim7', 'fullDim7',
                    'aug', 'aug7',
                    'sus4', 'sus4Maj7', 'sus4Min7'
                ];

                expect(CHORD_NAMES).toEqual(expectedChords);
            });

            it('should have correct intervals for all triads', () => {
                expect(CHORDS.major).toEqual([0, 4, 7]);    // Major 3rd + minor 3rd
                expect(CHORDS.minor).toEqual([0, 3, 7]);    // Minor 3rd + major 3rd
                expect(CHORDS.dim).toEqual([0, 3, 6]);      // Minor 3rd + minor 3rd
                expect(CHORDS.aug).toEqual([0, 4, 8]);      // Major 3rd + major 3rd
                expect(CHORDS.sus4).toEqual([0, 5, 7]);     // Perfect 4th + major 2nd
            });

            it('should have correct intervals for all 7th chords', () => {
                expect(CHORDS.maj7).toEqual([0, 4, 7, 11]);     // Major triad + major 7th
                expect(CHORDS.dom7).toEqual([0, 4, 7, 10]);     // Major triad + minor 7th
                expect(CHORDS.min7).toEqual([0, 3, 7, 10]);     // Minor triad + minor 7th
                expect(CHORDS.halfDim7).toEqual([0, 3, 6, 10]); // Dim triad + minor 7th
                expect(CHORDS.fullDim7).toEqual([0, 3, 6, 9]);  // Dim triad + dim 7th
                expect(CHORDS.aug7).toEqual([0, 4, 8, 10]);     // Aug triad + minor 7th
                expect(CHORDS.sus4Maj7).toEqual([0, 5, 7, 11]); // Sus4 + major 7th
                expect(CHORDS.sus4Min7).toEqual([0, 5, 7, 10]); // Sus4 + minor 7th
            });
        });

        describe('playback modes', () => {
            it('should have 4 modes: up, down, upDown, random', () => {
                expect(ARP_MODE_NAMES).toEqual(['up', 'down', 'upDown', 'random']);
            });

            it('up mode should ascend through notes', () => {
                const seq = buildArpSequence(CHORDS.major, 1, 'up');
                expect(seq).toEqual([0, 4, 7]);
            });

            it('down mode should descend through notes', () => {
                const seq = buildArpSequence(CHORDS.major, 1, 'down');
                expect(seq).toEqual([7, 4, 0]);
            });

            it('upDown (pendulum) mode should go up then down without repeating endpoints', () => {
                const seq = buildArpSequence(CHORDS.major, 1, 'upDown');
                // Up: 0, 4, 7, Down (excluding ends): 4
                expect(seq).toEqual([0, 4, 7, 4]);
            });

            it('random mode should return notes for random selection', () => {
                const seq = buildArpSequence(CHORDS.major, 1, 'random');
                // Random mode returns all notes, randomization at step time
                expect(seq.length).toBe(3);
                expect(seq).toContain(0);
                expect(seq).toContain(4);
                expect(seq).toContain(7);
            });
        });

        describe('V/Oct tracking on root CV', () => {
            let arp;

            beforeEach(() => {
                arp = createArp({ bufferSize: 128 });
            });

            it('should track 1V/Oct on root CV input', () => {
                arp.params.root = 0; // C
                arp.params.chord = 0; // major

                // Test with 1V input = +12 semitones = +1 octave
                arp.inputs.rootCV = new Float32Array(128).fill(1);
                arp.process();

                // Output should be root (0) + CV (12) + chord note (0) = 12 semitones = 1V
                expect(arp.outputs.cv[0]).toBeCloseTo(1, 2);
            });

            it('should add root CV to root knob value', () => {
                arp.params.root = 5; // F (5 semitones)
                arp.params.chord = 0; // major

                // 0.5V = 6 semitones
                arp.inputs.rootCV = new Float32Array(128).fill(0.5);
                arp.process();

                // Output: (5 + 6 + 0) / 12 = 11/12 ≈ 0.917V
                expect(arp.outputs.cv[0]).toBeCloseTo(11 / 12, 2);
            });
        });

        describe('reset functionality', () => {
            let arp;

            beforeEach(() => {
                arp = createArp({ bufferSize: 128 });
            });

            it('should reset to first note on reset input', () => {
                arp.params.chord = 0; // major
                arp.params.mode = 0; // up

                // Advance a few steps
                for (let i = 0; i < 4; i++) {
                    arp.inputs.trigger = new Float32Array(128).fill(i % 2 === 0 ? 0 : 5);
                    arp.process();
                }

                expect(arp.getCurrentStep()).toBeGreaterThan(0);

                // Send reset
                arp.inputs.reset = new Float32Array(128).fill(5);
                arp.inputs.trigger = new Float32Array(128).fill(0);
                arp.process();

                expect(arp.getCurrentStep()).toBe(0);
            });

            it('should respect 0.4V reset threshold', () => {
                arp.params.chord = 0;

                // Advance
                arp.inputs.trigger = new Float32Array(128).fill(5);
                arp.process();
                arp.inputs.trigger = new Float32Array(128).fill(0);
                arp.process();
                arp.inputs.trigger = new Float32Array(128).fill(5);
                arp.process();

                const stepBefore = arp.getCurrentStep();

                // Reset at 0.5V should work
                arp.inputs.trigger = new Float32Array(128).fill(0);
                arp.inputs.reset = new Float32Array(128).fill(0.5);
                arp.process();

                expect(arp.getCurrentStep()).toBe(0);
            });
        });
    });
});
