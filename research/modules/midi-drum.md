# MIDI Drum Triggers (`midi-drum`)

## Reference And Scope

This utility maps MIDI notes to eight trigger outputs plus a velocity CV. It is a practical GM-style drum adapter, not an emulation of one hardware module. Shared protocol notes are in [the MIDI module topic](../topics/midi-modules.md).

## Contract

- Configurable notes for kick, snare, closed hat, open hat, and percussion.
- Per-hit 0/10 V triggers with configurable duration.
- Velocity maps from 0-127 to 0-10 V.
- Channel zero means omni; other values select MIDI channels 1-16.

## DSP Audit (2026-07-11)

- **Measured**: deterministic drum-note events produce finite trigger activity across the full matrix.
- **Resolved**: velocity explicitly declares 0..10 V and focused tests cover note mapping, channel filtering, sample offsets, velocity, and reset.

## Sources

- [MIDI 1.0 Core Specifications](https://midi.org/midi-1-0-core-specifications) - MIDI Association, accessed 2026-07-11.
- [General MIDI Level 1](https://midi.org/general-midi-level-1) - MIDI Association; percussion-channel and note-map context.
