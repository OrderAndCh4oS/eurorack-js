# Ring modulator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Ring)

1. Start the patch. The two VCO triangles enter X and Y. A clocked envelope opens the VCA after Ring so you hear the product in short notes.
2. Turn Mix toward the effected signal and slowly retune the second VCO. Listen for new pitches rising and falling around the first oscillator.

## In a composition

For tuned metallic percussion, give the two oscillators a simple frequency ratio and use a short envelope. Detune one slightly for a more unsettled bell.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Mix (`mix`) | Blends the original X signal with the product of X and Y. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| X (`x`) | Audio | Supplies the first signal and the dry side of the mix. |
| Y (`y`) | Audio | Supplies the second, multiplying signal. A slow wave gives tremolo-like motion and an audio wave creates sidebands. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the dry/product blend at the Mix setting. |

## Design background

Ring modulation takes its name from a balanced modulator circuit. With two sine waves its product contains tones at their sum and difference frequencies.

[Research and implementation notes](../../research/modules/ring.md)
