# Gate delay

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Gate+Delay)

1. Press **Start**. CLK triggers channel 1. Its delayed gate opens an ADSR, and the ADSR controls the volume of a sawtooth through a VCA.
2. Turn **Dly 1** to move the entire note later. Leave the delay still and change **Len 1** to hear how long the envelope stays held.

## In a composition

Make a call and response with two envelopes. Send one the original trigger and the other a delayed gate. Give the response a different gate length.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Dly 1 (`delay1`), Dly 2 (`delay2`) | Sets the wait between a trigger on this channel and the start of its outgoing gate. |
| Len 1 (`length1`), Len 2 (`length2`) | Sets how long this channel’s outgoing gate stays high. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In 1 (`trig1`), In 2 (`trig2`) | Trigger · 0 to 10 V | Starts the corresponding channel’s delay timer on a rising edge. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out 1 (`gate1`), Out 2 (`gate2`) | Gate · 0 to 10 V | Goes high after the selected wait and lasts for the selected length. |

## Design background

This is a dual timing utility. Keeping start delay and gate duration independent lets one short pulse play a sustained note. [Doepfer A-162 Dual Trigger Delay](https://doepfer.de/a162.htm)

[Research and implementation notes](../../research/modules/gate-delay.md)
