# MIDI OUT

MIDI OUT lets a rack sequencer play or record notes on an external MIDI instrument track. It translates one pitch CV and gate pair into a monophonic note stream. The rack can receive notes and clock over a second bus while it sends the sequence.

## Panel and voltage contract

| Control or jack | Behavior |
| --- | --- |
| Channel | MIDI channel 1–16, default 1. An edit applies to the next note. |
| Pitch | 1 V/octave. Round to the nearest semitone with 0 V at MIDI note 60. Clamp the result to 0–127. Normal 0 V. |
| Gate | A rise to at least 1 V samples pitch, channel and velocity. Falling below 1 V releases that same note. Normal 0 V. |
| Velocity | 0–10 V maps to 0–127. Normal 10 V gives full velocity. Zero suppresses the note for that gate. |
| Gate LED | Lit while the module holds a sounding note. |
| Destination | A tab-local Web MIDI output chosen in the rack’s MIDI Setup dialog. The patch stores the channel. The destination starts off. |

## DSP model and assumptions

This is a utility adaptation of edge-triggered CV-to-MIDI conversion. The Doepfer A-192-2 samples pitch and velocity at the gate edge, which also fixes the identity of the later Note Off. Its documentation describes the wrong notes that can result when an external sequencer changes its pitch after the gate rises. In this rack the graph routes each sample of both inputs before the converter processes it. Continuous pitch tracking would retrigger a held gate when a CV glides between notes. Sampling the attack supports repeatable sequencer articulation at a lower MIDI message rate. [Doepfer A-192-2](https://doepfer.de/a1922.htm)

The hardware uses a learnable reference pitch, a 5 V gate minimum and 0–5 V velocity. This module uses the inverse of the rack's MIDI-CV pitch and velocity scales and its standard 1 V gate threshold. A nonfinite gate closes the note, a nonfinite pitch uses the middle-C normal and a nonfinite velocity mutes that attack. The converter has one voice, three inputs and a channel control. Additional voices can use additional instances.

## Implementation Plan

- Implement `midi-out` in category `midi`. Add the worklet registration and matching graph revision.
- Scan the gate buffer once. Emit a bounded batch of timestamped Note On/Off edges for each block that contains a transition. Translate worklet time to Web MIDI time on the browser thread. Main-thread delivery and the OS MIDI driver introduce timing jitter.
- Send only through the chosen output. Release notes owned by the rack on stop, module replacement or removal, and a destination change. Overlapping instances sharing a channel and key keep it sounding until the last owner releases it.
- Provide a starter patch with a voice played by incoming MIDI, a stereo recorder and an externally clocked sequencer wired to MIDI OUT. Use separate virtual buses for the two MIDI directions when connecting software.
- Write the focused DSP tests first. Exercise channel limits, positive and negative pitch, velocity rails and normal, the 1 V edge across blocks, release identity, short gates, nonfinite inputs, reset and LEDs. Then test actual browser worklet audio, MIDI routing and cleanup with virtual test ports.
- Run the module contract, patch and queue tests, `npm run audit:dsp -- --module midi-out --matrix --strict-voltage`, and `npm test`.

## DSP Audit (2026-11-22)

The strict matrix completed all 18 control scenarios at 44.1, 48 and 96 kHz with 128- and 512-frame blocks. All input buffers retained their identities. The focused DSP test verifies the outgoing note bytes and edge offsets. The Chromium starter test received a MIDI note, measured concert A on both audio channels, downloaded a stereo WAV, received clock and transport, and captured the four outgoing notes with matching releases on channel 2.

A second check used desktop Chrome with a temporary macOS CoreMIDI source and destination. At 48 kHz, MIDI note 69 measured 440 Hz on the rack output. Native clock and Start/Stop messages drove the sequencer, and the destination received keys 60, 64, 67 and 70 on channel 2 with four matching Note Offs. The endpoints were disposed at the end of the check.

## Sources

- Doepfer Musikelektronik, *A-192-2 Dual CV/Gate to Midi/USB Interface*, manufacturer operating notes, accessed 2026-11-22. Documents the gate-edge sampling, matched Note Off, velocity normal and calibration choices. [Operating notes](https://doepfer.de/a1922.htm)
- VCV, *Core Modules*, Rack 2 manual, accessed 2026-11-22. A comparable software module routes CV and gate to a selected MIDI device. [VCV Core manual](https://vcvrack.com/manual/Core#CV-MIDI)
- Bill’s Place, *Modular Minute – CV to MIDI*, 2019-10-26. The performer’s patch description assigns one A-192-2 channel to a Triton bass part and the other to drum notes in a DAW. This illustrates separate MIDI voices in a working patch. [Demo and patch description](https://www.youtube.com/watch?v=wkgXxsIVJbs)
- MIDI Association, *Summary of MIDI 1.0 Messages*, accessed 2026-11-22. Defines channel and note data ranges, Note On/Off status bytes and real-time transport messages. [Message table](https://midi.org/summary-of-midi-1-0-messages)
- W3C Audio Working Group, *Web MIDI API* and *Web Audio API*, accessed 2026-11-22. Define port state changes, timestamped sends, input arrival time and the audio-to-performance clock mapping. [Web MIDI](https://www.w3.org/TR/webmidi/) · [Audio output timestamps](https://webaudio.github.io/web-audio-api/#dom-audiocontext-getoutputtimestamp)
- Ableton, *Live’s MIDI Settings* and *Setting up a virtual MIDI bus*, accessed 2026-11-22. Describe one-way Track and Sync routing and macOS/Windows virtual ports. [MIDI settings](https://help.ableton.com/hc/en-us/articles/209774205-Live-s-MIDI-Settings) · [Virtual buses](https://help.ableton.com/hc/en-us/articles/209774225-Setting-up-a-virtual-MIDI-bus)
