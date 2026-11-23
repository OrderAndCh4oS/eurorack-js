# Noise generator (NSE)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Noise+Output)

1. Press **Start**. The noise output feeds both VCA channels. Turn **Rate** down in continuous mode and listen as fine hiss separates into coarser, slower changes.
2. For short bursts, turn on **VCA** and connect a clock to Trig. Rate now controls how long each burst lasts.

## In a composition

For a snare layer, mix a short triggered burst with a pitched drum. For wind, send continuous noise through a slowly moving band-pass filter.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate (`rate`) | Sets how often a new noise value is taken. In VCA mode it sets the decay of a triggered burst. |
| VCA (`vcaMode`) | Switches from continuous noise to noise bursts controlled by Trig. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Trig (`trigger`) | Trigger · 0 to 10 V | Strikes the noise envelope in VCA mode. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`noise`) | Audio · ±5 V | Supplies the noise signal, continuous or enveloped according to the panel setting. |

## Design background

The 2hp-style combination of a sample-held noise source and an internal envelope makes one small panel useful for both percussion and random modulation. [2hp Nse](https://www.twohp.com/modules/p/nse)

[Research and implementation notes](../../research/modules/nse.md)
