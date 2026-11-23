# Complex harmonic oscillator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Complex+VCO)

1. Start the patch. The sequencer sets pitch and gates the envelope, while an LFO moves Phase. Full takes the harmonic mix through a VCA.
2. Turn Even and Odd down to hear the fundamental alone, then add each back separately. Raise Phase to make the LFO’s motion more apparent.

## In a composition

For a metallic lead, try a second oscillator in TZ FM and bring its amount up from zero. For a bass, keep a strong fundamental under a quieter moving overtone layer.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Coarse (`coarse`) | Tunes the core oscillator within its selected range. |
| Fine (`fine`) | Offsets the core pitch in small intervals. |
| Exp FM (`expFmAmt`) | Sets the depth and direction of exponential FM, which changes pitch in musical intervals. |
| TZ FM (`tzFmAmt`) | Sets the depth of linear through-zero FM. |
| Phase (`phaseAmt`) | Sets the amount of phase modulation applied by the Phase input. |
| Fund (`fundLevel`), Even (`evenLevel`), Odd (`oddLevel`) | Sets the signed contribution of this harmonic family to Full. The centre removes it. |
| LF (`range`) | Selects audio or low-frequency operation. |
| AC (`tzFmAc`) | Blocks a constant offset in the through-zero FM path when enabled. |
| Bias (`tzFmBias`) | Adds a positive bias to the through-zero modulation input to shift its operating point. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| V/Oct (`vOct`) | Control voltage · ±10 V | Sets the played pitch at one volt per octave. |
| Exp (`expFm`) | Control voltage · ±5 V | Supplies exponential frequency modulation, scaled by Exp FM. |
| TZ FM (`tzFm`) | Control voltage · ±5 V | Supplies linear frequency modulation that can drive the phase through zero speed and into reverse. |
| Phase (`phase`) | Control voltage · ±5 V | Offsets oscillator phase under voltage control. |
| Reset (`reset`) | Trigger · 0 to 10 V | Restarts the oscillator phase on a rising pulse. |
| Flip (`flip`) | Trigger · 0 to 10 V | Reverses the direction of the oscillator phase on a rising pulse. |
| Fund AM (`fundAm`), Even AM (`evenAm`), Odd AM (`oddAm`) | Control voltage · ±5 V | Modulates the amplitude of the matching harmonic family. The unpatched input passes that family at its panel setting. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Core (`core`) | Audio | Supplies a triangle one octave below the fundamental. Try it as a bass reinforcement. |
| Fund (`fund`) | Audio | Supplies the sine fundamental at the played pitch. |
| Even (`even`) | Audio | Supplies the even-harmonic component. |
| Odd (`odd`) | Audio | Supplies the odd-harmonic component. |
| Full (`full`) | Audio | Combines the fundamental, even and odd components for the finished voice. |

## Design background

Joranalogue Generate 3 is a reference for combining harmonic mixing with through-zero frequency modulation. Strong linear modulation can reverse the direction of the oscillator’s phase. [Joranalogue Generate 3](https://joranalogue.com/products/generate-3)

[Research and implementation notes](../../research/modules/complex-vco.md)
