# Clock divider and multiplier (DIV)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Clock+Divisions)

1. Select **Start**. Out1 triggers the kick and Out2 triggers the closed hat. Listen to their spacing before touching the master clock.
2. Leave **Rate1** alone and turn **Rate2** through slower and faster ratios. The kick keeps its pattern while the hats change density.

## In a composition

Try a slow output for chord changes against a fast output for hi-hats. An odd division against an even one makes the accents meet on a longer cycle.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate1 (`rate1`), Rate2 (`rate2`) | Selects this channel’s timing ratio, from one pulse every sixteen beats through unity to sixteen pulses per input beat. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`clock`) | Trigger · 0 to 10 V | Supplies the common pulse train. Both channels derive their timing from its rising edges. |
| CV1 (`rate1CV`), CV2 (`rate2CV`) | Control voltage · 0 to 5 V | Moves the corresponding channel’s ratio under voltage control. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out1 (`out1`), Out2 (`out2`) | Trigger · 0 to 10 V | Sends the divided or multiplied pulse train for this channel. |

## Design background

Divider circuits count incoming pulses. A multiplier also estimates the space between ticks so it can place extra events inside an interval. [2hp Div](https://www.twohp.com/modules/p/div)

[Research and implementation notes](../../research/modules/div.md)
