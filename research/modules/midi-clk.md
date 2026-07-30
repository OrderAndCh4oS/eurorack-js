# MIDI Clock (`midi-clk`)

## Reference And Scope

This utility converts MIDI timing and transport events into Eurorack triggers and gates. Shared protocol research is in [the MIDI module topic](../topics/midi-modules.md).

## Contract

- MIDI timing clock is treated as 24 pulses per quarter note.
- Clock division selects which incoming pulses create output triggers.
- Start produces reset; start/continue and stop control the run gate.

## DSP Audit (2026-07-11)

- **Measured**: a deterministic start plus 24 clock messages produces finite 0/10 V outputs across the full matrix.
- **Resolved**: focused tests cover division, transport, multiple events in one block, and sample-offset output timing.
- **Timing**: clock and transport events carry AudioContext timestamps; late events use offset zero and future events remain queued.

## Sources

- [Expanded MIDI 1.0 Messages List](https://midi.org/expanded-midi-1-0-messages-list) - MIDI Association, accessed 2026-07-11; timing clock and transport status bytes.
- [Mutable Instruments Yarns documentation](https://pichenettes.github.io/mutable-instruments-documentation/modules/yarns/) - Mutable Instruments; modular clock-output precedent.

## Individual Contract Audit (2026-07-30, complete)

- Start, Continue, Stop, and all clock ticks retain arrival ordering and exact
  sample offsets. Start emits Clock and Reset and opens Run.
- Stop now closes an in-flight Clock pulse immediately with Run. Previously the
  stale five-millisecond Clock trigger continued after transport stopped.
- Division selection has a finite default; triggers remain exact 0/10V and reset
  clears transport, pulse counters, stable outputs, and both LEDs.
- The strict matrix completes three scenarios with finite output, zero voltage
  flags, stable buffers, and maximum Node diagnostic time below 0.049ms/block.
