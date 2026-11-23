# Sample and hold (S+H)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+S%26H+%E2%86%92+Pitch)

1. Press **Start**. Noise enters In1. CLK tells Trg1 when to sample, and Out1 sets the oscillator’s pitch.
2. Slow the clock to hear individual notes. Raise **Slew1** so the oscillator glides from one held value toward the next.

## In a composition

For a generative melody, insert a quantizer between Out1 and the oscillator. For rhythmic filter motion, send the held voltage to a filter instead.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Slew1 (`slew1`), Slew2 (`slew2`) | Softens transitions from one held value to the next on the corresponding channel. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In1 (`in1`), In2 (`in2`) | Any signal · ±12 V | The voltage to sample on this channel. Try noise for unpredictable steps or an LFO for related ones. |
| Trg1 (`trig1`), Trg2 (`trig2`) | Trigger · 0 to 10 V | A rising trigger tells the corresponding channel when to capture its input. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out1 (`out1`), Out2 (`out2`) | Any signal · ±12 V | Holds the last value sampled on this channel until another trigger arrives. |

## Design background

Sample-and-hold circuits store an incoming level at a chosen instant. The musical pattern comes from two independent choices, what to sample and when.

[Research and implementation notes](../../research/modules/sh.md)
