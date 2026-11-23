# Resonator bank

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Resonator+Bank)

1. Start the demo. SEQ pitch tunes the resonator and its gates strike the internal exciter. Odd and Even go to opposite speakers.
2. Lengthen the ringing with Damp, then move Strike Position (Pos) to change which resonances stand out. Compare the same phrase in another Model.

## In a composition

For tuned percussion, use a sparse gate pattern and leave space for each resonator to die away. Patch noise or another drum into Audio to hear its attack take on the resonator’s pitch.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Freq (`frequency`) | Tunes the resonant body’s basic note. |
| FM (`frequencyAmt`) | Sets the depth and direction of modulation from the Freq jack. |
| Struct (`structure`) | Changes relationships between resonances or strings, altering the character of the body. |
| S CV (`structureAmt`) | Sets the depth and polarity of Struct CV. |
| Bright (`brightness`) | Sets the strength of upper components in the resonant sound. |
| B CV (`brightnessAmt`) | Sets the depth and polarity of Bright CV. |
| Damp (`damping`) | Controls how long the resonances retain energy. Turn up for longer ringing. |
| D CV (`dampingAmt`) | Sets the depth and polarity of Damp CV. |
| Pos (`position`) | Moves the excitation or pickup position in the model to alter the harmonic balance. |
| P CV (`positionAmt`) | Sets the depth and polarity of Pos CV. |
| Model (`model`) | Chooses a modal body, sympathetically coupled strings, or a string model. Compare them with the same pitch and strike. |
| Poly (`polyphony`) | Chooses one, two or four available voices for overlapping strikes. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| V/Oct (`vOct`) | Control voltage · ±5 V | Tunes the resonator at one volt per octave. |
| Freq (`frequencyCv`) | Control voltage · ±5 V | Modulates tuning through the FM amount control. |
| Struct (`structureCv`) | Control voltage · ±5 V | Changes the structure under voltage control. |
| Bright (`brightnessCv`) | Control voltage · ±5 V | Changes the brightness under voltage control. |
| Damp (`dampingCv`) | Control voltage · ±5 V | Changes ringing time under voltage control. |
| Pos (`positionCv`) | Control voltage · ±5 V | Moves the excitation or pickup position under voltage control. |
| Strum (`strum`) | Trigger | Strikes the resonator and advances the voice allocation. |
| In (`audio`) | Audio | Excites the body with an external sound. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Mix (`mix`) | Audio | Combines both components of the resonator. |
| Odd (`odd`), Even (`even`) | Audio | Carries one complementary part of the resonating sound. Use the pair for stereo or process each side separately. |

## Design background

Mutable Instruments Rings is a reference for the separation between exciter and resonant body. The same body can sing very differently under a sharp impulse or a sustained external signal. [Rings manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/rings/manual/)

[Research and implementation notes](../../research/modules/resbank.md)
