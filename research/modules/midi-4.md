# Four-Voice MIDI-CV (`midi-4`)

## Reference And Scope

This is a four-voice MIDI-to-CV utility inspired by the polyphonic modes of Mutable Instruments Yarns. Shared protocol research is in [the MIDI module topic](../topics/midi-modules.md).

## Contract

- Four 1 V/octave pitch outputs and four 0/10 V gates.
- Rotate, lowest, and oldest-voice reassignment modes.
- Channel, transpose, and common pitch-bend controls.

## DSP Audit (2026-07-11)

- **Measured**: a deterministic three-note chord produces active voices across the full sample-rate/block-size matrix; all outputs remain finite and within their declarations.
- **Resolved**: focused tests cover polyphonic allocation, sample offsets, common bend, and the now-declared bend-range control.
- **Allocation contract**: `lowest` means the lowest numbered voice slot when all voices are occupied; `reassign` steals the oldest voice.

## Sources

- [MIDI 1.0 Core Specifications](https://midi.org/midi-1-0-core-specifications) - MIDI Association, accessed 2026-07-11.
- [Mutable Instruments Yarns documentation](https://pichenettes.github.io/mutable-instruments-documentation/modules/yarns/) - Mutable Instruments; polyphonic converter precedent.
