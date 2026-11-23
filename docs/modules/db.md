# Stereo level meter

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+dB+Meter)

1. Start the demo. Two LFO outputs move separate VCAs on a triangle and a saw. Both pass through the meter on their way to the speakers.
2. Switch Mode and compare the response of the bars on the faster swells. Change Hold to see how the highest recent reading persists even after a channel has fallen quiet.

## In a composition

Put the meter between a stereo submix and Out to balance a pad against percussion. Peak readings reveal short transients that may barely move an average display.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Mode (`mode`) | Selects averaged VU, peak or combined metering. Peaks respond most clearly to brief transients. |
| Hold (`hold`) | Enables the peak-hold marker so the latest peak remains visible briefly after the bar falls. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| L (`L`), R (`R`) | Audio · ±10 V | Feeds the left or right meter with the signal you want to measure. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| L (`outL`), R (`outR`) | Audio · ±10 V | Passes the corresponding input through for downstream monitoring. |

## Design background

The module combines the slower visual response associated with a VU meter and a peak display. Its through jacks let you measure at a specific point in the signal chain.

[Research and implementation notes](../../research/modules/db.md)
