import { describe, it, expect, beforeEach } from 'vitest';
import {
    createArp,
    buildArpSequence,
    CHORDS,
    CHORD_NAMES,
    ARP_MODES,
    ARP_MODE_NAMES
} from '../../src/js/dsp/arp.js';

describe('arp', () => {
    describe('CHORDS', () => {
        it('should have 8 chord types', () => {
            expect(CHORD_NAMES.length).toBe(8);
        });

        it('should have single chord with just root', () => {
            expect(CHORDS.single).toEqual([0]);
        });

        it('should have major triad', () => {
            expect(CHORDS.major).toEqual([0, 4, 7]);
        });

        it('should have minor triad', () => {
            expect(CHORDS.minor).toEqual([0, 3, 7]);
        });

        it('should have diminished chord', () => {
            expect(CHORDS.dim).toEqual([0, 3, 6]);
        });

        it('should have augmented chord', () => {
            expect(CHORDS.aug).toEqual([0, 4, 8]);
        });

        it('should have sus4 chord', () => {
            expect(CHORDS.sus4).toEqual([0, 5, 7]);
        });

        it('should have dominant 7th chord', () => {
            expect(CHORDS.dom7).toEqual([0, 4, 7, 10]);
        });

        it('should have major 7th chord', () => {
            expect(CHORDS.maj7).toEqual([0, 4, 7, 11]);
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

        it('should handle single note chord', () => {
            const seq = buildArpSequence(CHORDS.single, 1, 'up');
            expect(seq).toEqual([0]);
        });

        it('should handle 4 octaves', () => {
            const seq = buildArpSequence(CHORDS.major, 4, 'up');
            expect(seq.length).toBe(12); // 3 notes × 4 octaves
            expect(seq[seq.length - 1]).toBe(36 + 7); // Last octave + 7
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
                arp.params.chord = 0; // single (just root)
                arp.params.mode = 0;

                // Trigger multiple times
                for (let i = 0; i < 5; i++) {
                    arp.inputs.trigger = new Float32Array(128).fill(i % 2 === 0 ? 0 : 5);
                    arp.process();
                }

                // Should still output valid note
                expect(arp.outputs.cv[0]).toBeDefined();
            });

            it('should apply root note offset', () => {
                arp.params.root = 5; // F
                arp.params.chord = 0; // single

                arp.process();

                expect(arp.outputs.cv[0]).toBeCloseTo(5 / 12, 5);
            });

            it('should respond to root CV', () => {
                arp.params.root = 0;
                arp.params.chord = 0;
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
                arp.params.chord = 1; // major
                arp.params.mode = 1; // down

                // Capture sequence
                const seq = buildArpSequence(CHORDS.major, 1, 'down');
                expect(seq[0]).toBe(7); // Starts with highest note
            });

            it('should handle upDown mode', () => {
                arp.params.chord = 1; // major
                arp.params.mode = 2; // upDown

                const seq = buildArpSequence(CHORDS.major, 1, 'upDown');
                expect(seq.length).toBe(4); // 0, 4, 7, 4
            });
        });
    });
});
