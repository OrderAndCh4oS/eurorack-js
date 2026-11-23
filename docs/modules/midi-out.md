# Pitch and gate to MIDI

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+MIDI+In+and+Out)

1. In MIDI Setup enable a MIDI output, set the receiving instrument to MIDI OUT’s channel (channel 2 in this patch), and enable a clock-sending input. Start the rack and the external transport. SEQ supplies pitch and Gate Delay supplies note length to MIDI OUT.
2. Change a SEQ step and listen on the receiving instrument. Lengthen the gate on Gate Delay to hear longer external notes. The separate triangle voice and recorder in this demo are played by incoming MIDI notes.

[Connect MIDI hardware or a DAW](../midi.md)

## In a composition

Try sequencing an external bass alongside rack percussion. Patch an accent voltage to Velocity to give the receiving instrument a changing attack.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Chan (`channel`) | Selects the outgoing MIDI channel. Match it to the external instrument or receiving track. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Pitch (`pitch`) | Control voltage · ≈ −5 to 5.58 V | Chooses the note at the next gate rise. The pitch scale is one volt per octave with 0 V at MIDI note 60. |
| Gate (`gate`) | Gate · 0 to 10 V | A rising gate sends Note On and a falling gate sends the matching Note Off. |
| Vel (`velocity`) | Control voltage · 0 to 10 V | Sets attack strength from 0–10 V. An empty jack gives full velocity. Zero suppresses the note-on. |

## Design background

This reverses the usual MIDI-to-CV journey. The module samples the pitch when the gate rises and issues the matching note-off when the gate falls. [MIDI Association message summary](https://midi.org/summary-of-midi-1-0-messages)

[Research and implementation notes](../../research/modules/midi-out.md)
