# Stereo bitcrusher

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Bitcrusher)

1. Start the rack. A saw goes directly into both sides of Crush. Bring Mix toward wet, then reduce Bits and listen to the grain around the waveform.
2. Restore bit depth and reduce Rate on its own. Retune the VCO to hear the new inharmonic components move, then blend some dry signal back in.

## In a composition

For a chiptune phrase, try coarse level steps on a simple lead. For industrial drums, blend a low-rate version under the dry transients.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Bits (`bits`) | Selects amplitude resolution. Fewer bits give fewer possible levels and a rougher sound. |
| Rate (`rate`) | Sets the effective sample rate. Reducing it holds each value longer and can add inharmonic tones. |
| Mix (`mix`) | Blends the degraded sound with the clean source. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In L (`inL`), In R (`inR`) | Audio | Supplies the matching side of the sound to crush. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out L (`outL`), Out R (`outR`) | Audio | Carries the matching side of the processed stereo blend. |

## Design background

The two reductions reproduce different limitations of digital audio. A small number of amplitude levels adds quantization distortion, while widely spaced samples can fold high frequencies into the audible range.

[Research and implementation notes](../../research/modules/crush.md)
