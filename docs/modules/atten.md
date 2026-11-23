# Dual attenuverter

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Attenuverter)

1. Start the demo. The LFO goes through channel 1 before reaching oscillator pitch. Turn Att1 toward the centre until the note holds steady.
2. Move Att1 through the centre and listen to the pitch sweep change direction. Use Off1 to move the whole sweep up or down without changing its width.

## In a composition

For a subtle vibrato, shrink a wide LFO to a narrow pitch movement. For an accented bass part, invert an envelope and add an offset to make the filter close at each attack.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Att1 (`atten1`), Att2 (`atten2`) | Sets the gain of this channel. The centre silences the input, the right side passes it and the left side inverts it. |
| Off1 (`offset1`), Off2 (`offset2`) | Adds a constant voltage after scaling, shifting the whole movement up or down. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In1 (`in1`), In2 (`in2`) | Any signal · ±10 V | The signal to resize, invert or offset on this channel. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out1 (`out1`), Out2 (`out2`) | Any signal · ±10 V | Carries this channel’s scaled input plus its offset. |

## Design background

This utility follows the scale-and-offset approach of Mutable Instruments Shades. In patch terms, the amount controls the size and sign of a gesture and the offset chooses its resting point. [Mutable Instruments Shades manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/shades_2020/manual/)

[Research and implementation notes](../../research/modules/atten.md)
