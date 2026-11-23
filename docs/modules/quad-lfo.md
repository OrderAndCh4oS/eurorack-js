# Quadrature LFO

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Quad+LFO)

1. Start the patch and watch the two scope traces. The 0° output changes the filter, and the 90° output changes VCA level, so brightness peaks at a different point from loudness.
2. Slow **Rate** to follow that order. Swap the VCA’s 90° cable for 180° and listen to the change in the relationship.

## In a composition

For a four-part ambient passage, send one output to each part’s level. Their swells pass from voice to voice without writing four separate envelopes.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate (`rate`) | Sets the common speed of the four sine waves. |
| Range (`range`) | Selects the slow, faster or audio-rate band for the Rate knob. |
| CV Amt (`rateCvAmt`) | Scales the FM input’s influence on the common rate. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| 1V/Oct (`rateCV`) | Control voltage · ±5 V | Changes the common frequency at one volt per octave. |
| FM (`rateMod`) | Control voltage · ±5 V | Modulates the rate with depth set by CV Amt. |
| Reset (`reset`) | Trigger · 0 to 10 V | Returns all four waves to their defined phase positions. |
| Hold (`hold`) | Gate · 0 to 10 V | Freezes all four outputs at their current values while high. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| 0 (`out0`) | Control voltage · ±5 V | The reference sine wave for the other three outputs. |
| 90 (`out90`) | Control voltage · ±5 V | The same sine a quarter of a cycle ahead of the reference. |
| 180 (`out180`) | Control voltage · ±5 V | The opposite half of the reference sine, useful for complementary fades. |
| 270 (`out270`) | Control voltage · ±5 V | The fourth phase, three quarters of a cycle ahead of the reference. |

## Design background

Quadrature is a phase relationship. A quarter-cycle offset is useful for coordinated panning, filter motion and other movements that should stay locked together.

[Research and implementation notes](../../research/modules/quad-lfo.md)
