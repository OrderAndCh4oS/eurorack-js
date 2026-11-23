# MIDI to pitch and gate

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+MIDI-CV)

1. Open MIDI Setup and enable the input carrying your notes. Start the rack and hold a key on the selected channel. Pitch tunes the VCO and Gate opens the ADSR, which controls the VCA.
2. Move your controller’s modulation wheel while holding a note. Its separate Mod cable opens the filter. Try overlapping two notes with Legato on and off and listen to the start of the second note.

[Connect MIDI hardware or a DAW](../midi.md)

## In a composition

For a monophonic bass or a lead, record notes and wheel moves into the same MIDI clip. Change the rack’s filter or envelope later while replaying the performance.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Chan (`channel`) | Selects the MIDI channel to listen to. Match it to the keyboard or sequencer track. |
| Trans (`transpose`) | Shifts incoming notes by semitones, up to two octaves either way. |
| Bend (`bendRange`) | Sets the size in semitones of a full pitch-wheel movement. |
| Legato (`legato`) | Keeps the gate high across overlapping notes. Turn it off for a fresh articulation when changing notes. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Pitch (`pitch`) | Control voltage · ≈ −8 to 8.58 V | Tunes an oscillator at one volt per octave. MIDI note 60 gives 0 V before transpose and bend. |
| Gate (`gate`) | Gate | Goes high while a note is held. Connect to an envelope’s gate input. |
| Vel (`velocity`) | Control voltage · 0 to 10 V | Turns the force of the note attack into a 0–10 V control signal. |
| Mod (`mod`) | Control voltage · 0 to 10 V | Turns the modulation wheel (CC1) into 0–10 V for a filter, vibrato depth or another control. |

## Design background

The module translates MIDI Note On, Note Off, pitch bend and controller messages into the separate voltages of a modular voice. [MIDI Association message summary](https://midi.org/summary-of-midi-1-0-messages)

[Research and implementation notes](../../research/modules/midi-cv.md)
