# Stereo phaser

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Phaser)

1. Start the rack. A saw wave feeds both inputs and gives the phaser plenty of harmonics to sweep. Turn Mix up from dry and listen for the hollow band moving.
2. Increase feedback to make the sweep stand out, then slow Rate. Compare a narrow Depth with a wide one while leaving the oscillator unchanged.

## In a composition

For a slow psychedelic pad, stretch the sweep across a whole phrase. A smaller depth on a repeating bass pattern adds motion while keeping its pitched centre clear.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate (`rate`) | Sets how fast the notches sweep through the sound. |
| Depth (`depth`) | Sets how far the sweep travels. |
| Fdbk (`feedback`) | Feeds the processed sound back into the phasing network to sharpen the sweep. |
| Mix (`mix`) | Balances the original and phase-shifted signals, changing the depth of cancellation. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In L (`inL`), In R (`inR`) | Audio | Feeds the indicated side of the phaser with audio. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out L (`outL`), Out R (`outR`) | Audio | Carries that side of the swept stereo mix. |

## Design background

A phaser uses all-pass stages to change phase at different frequencies. Mixing their output with the original produces a set of moving cancellations.

[Research and implementation notes](../../research/modules/phaser.md)
