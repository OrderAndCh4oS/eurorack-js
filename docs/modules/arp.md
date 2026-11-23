# Arpeggiator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Arpeggiator)

1. Start the rack. CLK advances the arpeggiator, CV tunes the VCO and Gate fires the envelope. Those two cables give each pitch its own attack.
2. Choose a different Chord, then keep it fixed and turn Mode. Listen for the same collection of notes arriving in a different order. Raise Oct to let the line travel farther before it repeats.

## In a composition

In a dance track, send a divided clock for a bass ostinato or a faster clock for a high counterline. An occasional reset can bring the figure back to the downbeat.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Root (`root`) | Chooses the starting note on which the chord is built. |
| Chord (`chord`) | Selects a chord quality and therefore which intervals the arpeggio visits. |
| Mode (`mode`) | Chooses ascending, descending, up/down or random note order. |
| Oct (`octaves`) | Sets whether the figure covers one or two octaves. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Trig (`trigger`) | Trigger | Advances to the next note on a rising pulse. Irregular pulses create irregular phrasing. |
| Rst (`reset`) | Trigger | Returns the note order to the beginning of the arpeggio. |
| Root (`rootCV`) | Control voltage | Adds a one-volt-per-octave root movement to transpose the chord. |
| Chrd (`chordCV`) | Control voltage · 0 to 5 V | Selects different chord qualities from another voltage source. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| V/Oct (`cv`) | Control voltage · ≈ −5 to 7.83 V | Sends the current arpeggio note as pitch voltage. |
| Gate (`gate`) | Gate | Supplies the articulation for an envelope or percussion trigger alongside the pitch. |

## Design background

An arpeggio breaks a chord into successive notes. This panel gives the instrument’s clock, tuning and phrasing separate patch points so the surrounding rack can conduct it. [2hp Arp](https://www.twohp.com/modules/p/arp)

[Research and implementation notes](../../research/modules/arp.md)
