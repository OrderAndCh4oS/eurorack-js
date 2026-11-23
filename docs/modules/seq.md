# Eight-step sequencer

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Sequencer)

1. Start the rack and follow the lit step. CV goes to oscillator pitch. Gate starts the ADSR, which opens the VCA on the filtered saw.
2. Move one numbered knob and wait for that step to return. Then turn off its numbered gate. The pitch sequence still advances, but that step no longer starts an envelope.

## In a composition

For a bass ostinato, keep the pitch contour simple and introduce rests with the gates. A seven-step length over a four-beat drum loop shifts the accents on every pass.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| 1 (`step1`), 2 (`step2`), 3 (`step3`), 4 (`step4`), 5 (`step5`), 6 (`step6`), 7 (`step7`), 8 (`step8`) | Sets the voltage sent when this numbered step plays. With CV patched to an oscillator, this sets that note’s pitch. |
| Len (`length`) | Sets how many positions the sequence uses before it repeats. |
| Rng (`range`) | Selects a 0–1, 0–2 or 0–4 V span for the step knobs. |
| Dir (`direction`) | Chooses forward, backward, doubled-step, pendulum or random playback. |
| G1 (`gate1`), G2 (`gate2`), G3 (`gate3`), G4 (`gate4`), G5 (`gate5`), G6 (`gate6`), G7 (`gate7`), G8 (`gate8`) | Enables or mutes the gate for this step. Its pitch knob still determines its CV value. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Clk (`clock`) | Trigger · 0 to 10 V | Advances one step per incoming pulse. |
| Rst (`reset`) | Trigger · 0 to 10 V | Restarts the sequence so it can line up with another pattern. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| CV (`cv`) | Control voltage · 0 to 4 V | Holds the voltage set by the current step. |
| Gate (`gate`) | Gate · 0 to 10 V | Sends the articulation for enabled steps. Patch it to an ADSR or trigger input. |

## Design background

This is the basic layout of an analogue step sequencer. A clock visits a row of stored knob positions and a second row specifies rhythmic articulation. [Doepfer A-155 analogue sequencer](https://doepfer.de/a155.htm)

[Research and implementation notes](../../research/modules/seq.md)
