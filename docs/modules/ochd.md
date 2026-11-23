# Øchd eight-speed LFO

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+OCHD)

1. Start the patch and follow the two cables into the attenuverter. Output 3 sweeps filter cutoff while output 1 moves resonance. A steady saw lets you hear those changes clearly.
2. Bring the two attenuverter amounts up one at a time to learn each movement. Then turn Øchd’s Rate and listen to both speeds change together.

## In a composition

For a slowly changing drone, send a fast lane gently into timbre and a slow lane into the effects mix. Leave spare lanes for other parts of the arrangement.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate (`rate`) | Changes the speed of the entire bank while preserving the differences between its eight lanes. |
| CV Amt (`rateCvAmt`) | Sets the depth and direction of the external speed control. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| CV (`rateCV`) | Control voltage · ±5 V | Modulates the common rate of the eight LFOs. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| 1 (`out1`) | Control voltage · ±5 V | The fastest free-running triangle voltage. |
| 2 (`out2`), 3 (`out3`), 4 (`out4`), 5 (`out5`), 6 (`out6`), 7 (`out7`) | Control voltage · ±5 V | A free-running triangle slower than the output above it and faster than the one below. |
| 8 (`out8`) | Control voltage · ±5 V | The slowest triangle, useful for motion across a whole section. |

## Design background

The Instruō and DivKid øchd uses eight free-running LFOs ordered from fastest to slowest. That relationship is the starting point for this software version. [Instruō øchd](https://www.instruomodular.com/product/ochd/)

[Research and implementation notes](../../research/modules/ochd.md)
