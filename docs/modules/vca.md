# Voltage-controlled amplifier (VCA)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+ADSR+Envelope)

1. Start the patch. Follow the two cables into channel 1. In 1 carries the sawtooth you hear. CV 1 carries the ADSR shape that makes the sawtooth audible on each clock pulse.
2. Lower **Ch1** to reduce the level of every note. Restore it and shorten the envelope’s release. Now the length changes while the VCA’s gain setting stays put.

## In a composition

For tremolo on a held chord, use a slow LFO in the CV socket. For a rhythmic drone, replace the LFO with a sequence of envelopes, one per accent.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Ch1 (`ch1Gain`), Ch2 (`ch2Gain`) | Sets the gain available on this channel. With no CV cable it acts as a manual level knob. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In 1 (`ch1In`), In 2 (`ch2In`) | Any signal · ±10 V | The audio or control voltage whose level this channel will change. |
| CV 1 (`ch1CV`), CV 2 (`ch2CV`) | Control voltage · 0 to 5 V | Opens this channel in proportion to the incoming voltage. Zero closes it and 5 V gives the full panel gain. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out1 (`ch1Out`), Out2 (`ch2Out`) | Any signal · ±10 V | Carries the corresponding input scaled by that channel’s knob and CV. |

## Design background

A voltage-controlled amplifier is an automated fader. The same multiplication also works on control signals, so one envelope can gradually introduce vibrato from an LFO.

[Research and implementation notes](../../research/modules/vca.md)
