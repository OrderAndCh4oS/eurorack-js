# Euclidean rhythm generator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Euclidean)

1. Start the patch. Each clock advances one position and each occupied position sends a pulse straight to the kick.
2. Try three Hits in eight steps. Leave those two values fixed and turn Rotate one step at a time. You can hear the same spacing begin on a different beat.

## In a composition

Pair two generators on one clock, with one playing three hits and another playing five. They make an interlocking percussion part without programming each hit individually.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Length (`length`) | Chooses the number of step positions in a repeating rhythm. |
| Hits (`hits`) | Chooses how many of the available positions receive a hit. |
| Rotate (`rotate`) | Moves the same hit pattern around the cycle. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Clk (`clock`) | Trigger · 0 to 10 V | Advances the pattern by one position per pulse. |
| Rst (`reset`) | Trigger · 0 to 10 V | Starts the cycle again to align it with another part. |
| Len (`lenCV`) | Control voltage · ±5 V | Modulates the number of steps in the pattern. |
| Hits (`hitsCV`) | Control voltage · ±5 V | Modulates how many positions contain hits. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Trig (`trig`) | Trigger · 0 to 10 V | Sends a short pulse on each occupied position. |

## Design background

Godfried Toussaint showed how an algorithm for distributing pulses can describe a number of traditional rhythmic patterns. [The Euclidean Algorithm Generates Traditional Musical Rhythms](https://www.archive.bridgesmathart.org/2005/bridges2005-47.html)

[Research and implementation notes](../../research/modules/euclid.md)
