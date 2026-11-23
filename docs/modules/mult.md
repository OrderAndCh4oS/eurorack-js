# Multiple (signal splitter)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Mult)

1. Start the patch. The LFO enters the first bank. Two of its outputs move the pitches of separate sawtooth oscillators, whose sounds meet in the mixer.
2. Turn the LFO’s Rate and listen to both oscillators move together. Unplug just one Mult-to-VCO cable to hear a moving voice against a steady one.

## In a composition

For ensemble phrasing, send a single gate to several envelopes through a Mult and set each envelope differently. The instruments agree on when to start while keeping their own articulation.

## Panel reference

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In 1 (`in1`) | Any signal | Feeds the three outputs in the first bank. |
| In 2 (`in2`) | Any signal | Feeds the second group of three outputs. With this jack empty, the second bank also copies input 1. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| 1A (`out1a`), 1B (`out1b`), 1C (`out1c`) | Any signal | A separate copy of the signal entering bank 1. |
| 2A (`out2a`), 2B (`out2b`), 2C (`out2c`) | Any signal | A separate copy of the signal feeding bank 2. |

## Design background

The module mirrors the labelled branches of a hardware multiple. Rack outputs can also feed several cables directly, so the panel can serve as a visible junction in a busy patch. [2hp Mult](https://www.twohp.com/modules/p/mult)

[Research and implementation notes](../../research/modules/mult.md)
