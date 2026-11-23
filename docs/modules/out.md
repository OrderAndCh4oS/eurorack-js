# Stereo output (OUT)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+VCO+Only)

1. Start at a low **Vol** setting. In this patch, VCA channel 1 feeds a triangle to L and channel 2 feeds a brighter sawtooth to R.
2. Turn down one VCA channel at a time. Restore both and adjust Vol. The single master knob moves both sides together while their balance stays put.

## In a composition

When building a stereo drone, tune the two sides against each other at low volume. For a centred mono bass, split the same final signal to L and R.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Vol (`volume`) | Sets the final listening level of this output module. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| L (`L`) | Audio | Sends the patched signal to the left side of the browser’s stereo audio output. |
| R (`R`) | Audio | Sends the patched signal to the right side of the browser’s stereo audio output. |

## Design background

Hardware modular systems need an output stage to meet the next device. Here OUT hands a stereo pair to the browser’s audio engine.

[Research and implementation notes](../../research/modules/out.md)
