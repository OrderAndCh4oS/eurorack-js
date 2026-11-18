# Rack laws

The three claims in [LAWS.bend](LAWS.bend) cover the following behavior.

| Law | Meaning in the rack |
| --- | --- |
| `stepped_control` | A requested nonnegative position stays within the last available position. Every legal position is preserved. The knob adapter converts a bounded drag or MIDI value to an index relative to the declared minimum. |
| `input_normal` | A disconnected input's normal is accepted exactly when both inclusive comparisons pass. JavaScript verifies finite numbers and compares the original voltages without rounding them to millivolts. |
| `ascending_octaves` | For any chord of integral semitone intervals, one octave plays the chord once. Two octaves append the same notes twelve semitones higher. ARP builds its cached sequences with this function. |

[Rack.bend](Rack.bend) is compiled to the JavaScript loaded by the rack.
[PROOF.bend](PROOF.bend) discharges the claims. With Bend **2.0.40** on
your path, run `npm run laws:check` after `npm ci`. This runs
`bend PROOF.bend --verdict` and compares regenerated JavaScript with the
checked-in copy. Use `npm run laws:generate` after changing the Bend source.
Set `BEND` to use a specific compiler and `BENDTT` to use a native checker
built from that release's `bend2/bendtt.lean`. CI runs the reference kernel
with Lean 4.34.0. [Release](https://github.com/bendlang/bend/releases/tag/v2.0.40)
and [language guide](https://github.com/bendlang/bend/blob/v2.0.40/guide/GUIDE.md#laws-and-proofs).

`npm test -- tests/rack/control-wiring.test.js` operates every built-in
scalar panel control through the renderer, host, message handler and worklet
DSP instance and checks each control's MIDI Learn target and range. It also
requires each parameter to be consumed by processing,
display drawing or a declared state edit. A disconnected-amplifier test
checks that storing and serializing a value alone fails this guard.
Module tests supply the stimulus and expected voltage, sequence,
state change or displayed trace for individual behaviors. Chromium also
captures the notes at OUT while switching ARP between one and two octaves.
`npm run audit:dsp -- --matrix --strict-voltage` checks sampled output
against each port's own rails at 44.1, 48 and 96 kHz with 128- and 512-frame
blocks.

Bend has an audio precedent in ezaudio's PCM/WAV operations and its MPEG
analysis filterbank and MDCT. These are examples of audio algorithms written
in Bend. Here the kernel verifies the discrete control and pitch functions,
while measured tests exercise floating-point audio and browser interaction.
[ezaudio source, laws and proofs](https://github.com/Emerging-Patterns/ezaudio).
