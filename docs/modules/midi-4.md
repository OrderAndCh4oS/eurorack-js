# Four-voice MIDI interface

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+MIDI-4+Poly)

1. Enable your MIDI input, start the rack and hold a chord. Follow the four pitch cables to the four oscillators. Their triangles meet in the mixer and share a filter.
2. Watch the four envelopes as you add and release notes. In this patch the first envelope opens the final VCA for the whole chord. For independently fading notes, put a VCA on each oscillator before the mixer and use its matching envelope.

[Connect MIDI hardware or a DAW](../midi.md)

## In a composition

For a string pad, give the voices slightly different tuning and pan them in pairs. Try changing Mode while repeating a chord to hear which oscillator receives each note.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Chan (`channel`) | Chooses the MIDI channel supplying all four voices. |
| Trans (`transpose`) | Transposes every voice by the same number of semitones. |
| Bend (`bendRange`) | Sets how far a full pitch bend shifts the four pitch outputs. |
| Mode (`mode`) | Chooses Rotate, Lowest or Reassign for distributing incoming notes among the voice slots. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| P1 (`pitch1`), P2 (`pitch2`), P3 (`pitch3`), P4 (`pitch4`) | Control voltage · ≈ −8 to 8.58 V | Carries the pitch of the note allocated to this voice at one volt per octave. Pair it with the gate bearing the same number. |
| G1 (`gate1`), G2 (`gate2`), G3 (`gate3`), G4 (`gate4`) | Gate | Opens the envelope for this voice while its assigned note is active. |

## Design background

A polyphonic synth needs a voice allocator to decide where each new finger goes. Exposing that allocation as pitch and gate pairs lets you give each finger a different instrument.

[Research and implementation notes](../../research/modules/midi-4.md)
