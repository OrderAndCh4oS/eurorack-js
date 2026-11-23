# Clock (CLK)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Clock+Divisions)

1. Press **Start**. CLK sends pulses into DIV. The two divider outputs trigger a kick and a closed hi-hat, which meet at MIX.
2. Turn **Rate** and hear both rhythms speed up together. Toggle **Pause** to stop sending ticks, then resume and listen for the relationship between the two parts.

## In a composition

Use one clock for a dance track’s kick, hats and bass sequencer. Divide its pulses when a part should move more slowly.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate (`rate`) | Sets how frequently the clock pulses. Its range runs from long beat intervals into the audio range. |
| Pause (`pause`) | Toggles the clock’s pause from the panel. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Rate (`rateCV`) | Control voltage · 0 to 10 V | Adds voltage to the rate setting. Use an envelope or sequencer to change tempo during a phrase. |
| Pause (`pause`) | Trigger · 0 to 10 V | A high gate above 2 V pauses the clock. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`clock`) | Trigger · 0 to 10 V | Sends the recurring 10 V pulses that advance sequencers or strike percussion. |

## Design background

Modular clocks carry timing on a cable. This lets an envelope, counter or sequencer use the same pulse for a completely different musical job. [2hp Clk](https://www.twohp.com/modules/p/clk)

[Research and implementation notes](../../research/modules/clk.md)
