# MIDI CC To CV (`midi-cc`)

## Reference And Scope

This utility maps four MIDI control-change values to slewed control voltages. Shared protocol research is in [the MIDI module topic](../topics/midi-modules.md).

## Contract

- Four configurable controller numbers on one MIDI channel.
- MIDI values 0-127 map to 0-10 V.
- A fixed 5 ms one-pole slew suppresses abrupt steps.

## DSP Audit (2026-07-11)

- **Measured**: deterministic CC values produce finite, monotonic slewed outputs across the full matrix.
- **Resolved**: all four outputs explicitly declare 0..10 V and focused tests cover mapping, slew direction, bounds, and reset.
- **Future quality option**: expose slew time only if controller stepping is audibly objectionable; the fixed short slew is a defensible minimal interface.

## Sources

- [Summary of MIDI 1.0 Messages](https://midi.org/summary-of-midi-1-0-messages) - MIDI Association, accessed 2026-07-11; control-change number/value fields.
- [Expert Sleepers FH-2](https://www.expert-sleepers.co.uk/fh2.html) - Expert Sleepers; configurable MIDI-to-CV precedent.

## Individual Contract Audit (2026-07-30, complete)

- Channel, controller assignments, and incoming controller values are bounded
  to the MIDI 0-15/0-127 contracts. Invalid values recover to defaults or 0V.
- The existing five-millisecond one-pole slew remains sample-rate based and all
  four outputs stay finite, monotonic, and within 0-10V.
- Reset now clears the activity LED as well as slew state and stable outputs.
- The strict matrix completes eleven scenarios with finite output, zero voltage
  flags, stable buffers, and maximum Node diagnostic time below 0.127ms/block.
