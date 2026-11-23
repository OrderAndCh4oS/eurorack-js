# MIDI controller to CV

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+MIDI-CC)

1. Enable your MIDI input, start the rack and hold a note. Send the controller number shown on CC1. Its first output moves the cutoff of the filter on the pulse-wave voice.
2. Try the numbers assigned to CC3 and CC4. One changes oscillator frequency through FM, the other brings up the filter’s resonance. CV2 is free for another destination.

[Connect MIDI hardware or a DAW](../midi.md)

## In a composition

For a live dub mix, dedicate a fader to feedback and another to the level of the return. Writing those moves as MIDI gives you a repeatable performance.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Chan (`channel`) | Selects the MIDI channel whose controller messages reach this panel. |
| CC1 (`cc1`), CC2 (`cc2`), CC3 (`cc3`), CC4 (`cc4`) | Sets the MIDI controller number (0–127) to listen for on the correspondingly numbered output. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| CV1 (`cv1`), CV2 (`cv2`), CV3 (`cv3`), CV4 (`cv4`) | Control voltage · 0 to 10 V | Carries the value of the assigned controller as a smoothed 0–10 V signal. |

## Design background

MIDI Control Change messages carry a controller number and value. This interface assigns each chosen number to a separate cable. [MIDI Association message summary](https://midi.org/summary-of-midi-1-0-messages)

[Research and implementation notes](../../research/modules/midi-cc.md)
