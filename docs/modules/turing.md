# Turing looping random sequencer

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Turing)

1. Start the rack. Each clock advances Turing. CV passes through a quantizer to the oscillator, while Pulse triggers the envelope that articulates the notes.
2. Move Lock toward the middle and listen for a phrase you like. Turn it fully clockwise to keep that pattern. Change Scale to narrow the range of pitches fed to the quantizer.

## In a composition

For a minimalist bass line, lock a short loop and briefly allow a change at the end of every fourth bar. Most of the figure stays familiar while one detail evolves.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Lock (`lock`) | Fully clockwise repeats the current pattern. The centre introduces random changes and the opposite extreme produces an inverted repeating cycle. |
| Scale (`scale`) | Sets the voltage range of the generated sequence, controlling the span of notes after a quantizer. |
| Len (`length`) | Chooses the number of stages recirculating in the loop. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Clk (`clock`) | Trigger · 0 to 10 V | Shifts the register one position for each incoming pulse. |
| CV (`lockCV`) | Control voltage · ±5 V | Changes the probability of altering the pattern under voltage control. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| CV (`cv`) | Control voltage · 0 to 5 V | Supplies the looping stepped voltage for pitch or another control. |
| Pulse (`pulse`) | Gate · 0 to 10 V | Supplies the bit-derived rhythmic pulse for a gate or trigger destination. |

## Design background

Tom Whitwell’s Music Thing Modular Turing Machine uses a recirculating shift register. Changing the chance of flipping a bit lets a sequence sit between repetition and chance. [Music Thing Modular Turing Machine](https://www.musicthing.co.uk/Turing-Machine/)

[Research and implementation notes](../../research/modules/turing.md)
