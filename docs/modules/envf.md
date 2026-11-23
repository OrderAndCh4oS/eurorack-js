# Envelope follower

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Envf)

1. Start the rack. An LFO makes the first oscillator swell through a VCA. ENVF listens to that sound and its Env output opens the VCA on a second oscillator.
2. Switch Slope and hear the second voice respond more or less quickly to changes in the first. Turn Thresh up to leave its quietest movements behind.

## In a composition

For a sidechain effect, use a kick as the source and put the inverted envelope through an attenuverter with an offset to duck a sustained voice.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Thresh (`threshold`) | Sets how loud the input must be before the follower responds. |
| Gain (`gain`) | Scales the level of the resulting envelope. |
| Slope (`slope`) | Chooses a fast or slow response to changes in loudness. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`audio`) | Audio · ±5 V | The sound whose loudness contour you want to measure. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Env (`env`) | Control voltage · 0 to 10 V | Rises with the detected loudness and falls as the sound fades. |
| Inv (`inv`) | Control voltage · 0 to 10 V | Supplies the complementary envelope, 10 V minus Env. It falls as the source gets louder. |

## Design background

This follower draws on the Plankton Electronics ENVF design. Measuring amplitude over time makes audio usable as a source of control for another instrument.

[Research and implementation notes](../../research/modules/envf.md)
