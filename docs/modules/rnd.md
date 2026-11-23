# Random voltage generator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Rnd)

1. Start the patch. Step goes through a quantizer to oscillator pitch, Smooth moves the filter and Gate fires the envelope. Each output has a distinct musical job.
2. Lower Rate and follow a few notes. Try another Seed, then change Amp to adjust how much of the quantizer and filter range the voltages travel through.

## In a composition

For a generative melody, keep Amp low for neighbouring notes or open it up for wider leaps. Clock Rnd from the drum pattern to tie its decisions to the groove.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate (`rate`) | Sets how often new values are chosen on the internal clock. |
| Amp (`amp`) | Sets the excursion of the random voltage outputs. |
| Seed (`seed`) | Chooses a repeatable random sequence. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Clk (`clock`) | Trigger · 0 to 10 V | Times new values from an external rhythm in place of the internal clock. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Step (`step`) | Control voltage · 0 to 10 V | Holds a new random voltage at each update. |
| Smth (`smooth`) | Control voltage · 0 to 10 V | Supplies flowing random movement for parameters such as filter cutoff. |
| Gate (`gate`) | Gate · 0 to 10 V | Supplies random gates for articulating an envelope or striking percussion. |

## Design background

The three outputs follow the idea of compact random-voltage utilities such as the 2hp Rnd. Separating steps, curves and gates lets one source shape melody, colour and articulation.

[Research and implementation notes](../../research/modules/rnd.md)
