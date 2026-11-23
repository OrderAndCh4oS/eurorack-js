# Twelve-band vocoder

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Vocoder)

1. Start the demo. A kick and triggered noise are mixed into Modulator. A saw oscillator feeds Carrier. The spectrum display shows the shaped output that reaches the speakers.
2. Lengthen Release to let each rhythmic articulation run into the next. Move Shift to hear those movements applied to different parts of the carrier’s spectrum.

## In a composition

For rhythmic pads, use a drum loop as the modulator and a harmonically rich chord as carrier. Short release settings keep the drum accents clearly separated.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Analysis (`analysisGain`) | Adjusts the level presented to the analysis bands by the modulator. |
| Carrier (`carrierGain`) | Adjusts the carrier level available for resynthesis. |
| Attack (`attackMs`) | Sets how quickly a band opens when energy appears in the modulator. |
| Release (`releaseMs`) | Sets how long a band takes to close as its energy fades. |
| Shift (`shift`) | Moves the mapping between analysis bands and carrier bands. |
| Sibilance (`sibilance`) | Adds high-frequency material to preserve hiss and consonant-like attacks. |
| Mix (`mix`) | Balances the original modulator with the vocoded output. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Mod (`modulator`) | Audio · ±5 V | The sound whose changing band levels control the effect. Try a voice or percussion. |
| Car (`carrier`) | Audio · ±5 V | The sound shaped by those band levels. A harmonically rich oscillator works well. |
| Shift (`shiftCv`) | Control voltage · ±5 V | Shifts the mapping of analysis bands under voltage control. |
| Mix (`mixCv`) | Control voltage · ±5 V | Changes the dry/effected balance from another module. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio · ±5 V | Carries the carrier articulated by the modulator, blended according to Mix. |

## Design background

A channel vocoder splits a sound into bands, follows the level of each band and imposes those envelopes on a second bank. This rack version uses twelve bands. [Doepfer A-129 analysis and synthesis banks](https://doepfer.de/a129e.htm)

[Research and implementation notes](../../research/modules/vocoder.md)
