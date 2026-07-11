# MIDI-CV (`midi-cv`)

## Reference And Scope

This is a utility adaptation of a monophonic MIDI-to-CV interface, informed by the official MIDI 1.0 message contract and Mutable Instruments Yarns. It is not intended as a circuit-level emulation. Shared MIDI protocol notes live in [the MIDI module topic](../topics/midi-modules.md).

## Contract

- Last-note priority with optional legato behavior.
- Note 60 maps to 0 V; pitch follows 1 V/octave.
- Gate is 0/10 V. Velocity and modulation are 0-10 V.
- Pitch bend is bipolar and scaled by the configurable bend range.

## DSP Audit (2026-07-11)

- **Measured**: deterministic note, bend, and modulation events process at 44.1, 48, and 96 kHz with 128- and 512-sample blocks. Buffers remain finite and stable.
- **Resolved**: pitch declares its full note/transpose/bend range; velocity and modulation declare 0..10 V.
- **Coverage**: focused tests cover sample offsets, expression mapping, held-note fallback, and reset.
- **Timing**: note events carry AudioContext timestamps and are applied at exact worklet-block sample offsets.

## Sources

- [MIDI 1.0 Core Specifications](https://midi.org/midi-1-0-core-specifications) - MIDI Association, 1996 revision, accessed 2026-07-11; canonical message layout.
- [Mutable Instruments Yarns documentation](https://pichenettes.github.io/mutable-instruments-documentation/modules/yarns/) - Mutable Instruments; converter behavior and musical precedent.
