# Probability sequencer

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Probability+Sequencer)

1. Start the patch. Its Gate strikes the plucked string and appears on the scope’s first channel. The second trace marks the end of the pattern.
2. Select a step in the editor. Set its probability to full and raise its ratchet count to hear a repeatable roll. Lower its probability and listen across several passes to hear the roll come and go.

## In a composition

For shifting breakbeats, leave downbeats certain and spend the probability on ghost hits. Reserve a conditional step for a fill so the main groove remains recognizable.

## Panel reference

Select one of the eight step pads to edit it. **Enable / Skip** decides if the step can play. **PROB** sets the chance from 0 to 100 percent. **RATCH** fits one to eight strikes inside the step. **COND** can test the previous step, the Fill input, or the current pass through a two- or four-cycle phrase.

### Controls

| Panel | What it does |
| --- | --- |
| Seed (`seed`) | Chooses a repeatable starting point for probability decisions. |
| Length (`length`) | Sets how many of the programmed steps belong to the active loop. |
| BPM (`fallbackBpm`) | Sets the internal tempo used when the sequencer has no external clock. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Clock (`clock`) | Trigger · 0 to 10 V | Supplies the step timing from another module. |
| Reset (`reset`) | Trigger · 0 to 10 V | Aligns the pattern and its seeded decisions to a new start. |
| Fill (`fill`) | Gate · 0 to 10 V | Enables conditions that depend on a fill, useful for a momentary variation. |
| Prob CV (`probabilityCv`) | Control voltage · ±5 V | Offsets the current step’s probability so several steps can become busier or sparser together. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Gate (`gate`) | Trigger · 0 to 10 V | Sends the gates for successful steps and their ratchets. |
| EOC (`eoc`) | Trigger · 0 to 10 V | Marks the end of a cycle with a pulse. |

## Design background

This rhythm sequencer combines the fixed positions of a step grid with seeded decisions. The seed lets a probabilistic phrase be revisited.

[Research and implementation notes](../../research/modules/prob-seq.md)
