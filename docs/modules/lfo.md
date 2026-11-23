# Low-frequency oscillator (LFO)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+LFO+%E2%86%92+VCO+Pitch)

1. Start the patch. Pri goes straight to the VCO’s V/Oct input. The wide pitch sweep makes the control movement easy to hear.
2. Turn **Rate** down until you can follow one cycle, then sweep **Wave**. For a smaller vibrato, insert an attenuverter between Pri and V/Oct and reduce the amount.

## In a composition

For a slow-moving pad, send Pri to cutoff and Sec to a different destination. The outputs share a speed but trace different shapes.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate (`rateKnob`) | Sets the speed of the repeating movement within the selected range. |
| Wave (`waveKnob`) | Moves between waveform shapes and therefore changes the contour of the movement. |
| Fast (`range`) | Switches between the slow and fast rate ranges. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Rate (`rateCV`) | Control voltage · 0 to 5 V | Adds voltage to speed up the oscillator. |
| Wave (`waveCV`) | Control voltage · 0 to 5 V | Moves through the wave shapes under voltage control. |
| Reset (`reset`) | Trigger · 0 to 10 V | Restarts the wave’s phase on a rising pulse. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Pri (`primary`) | Control voltage · 0 to 5 V | Supplies the main 0–5 V waveform for movement above a control’s resting setting. |
| Sec (`secondary`) | Control voltage · 0 to 5 V | Supplies a companion 0–5 V waveform at the same rate with its own shape. |

## Design background

A low-frequency oscillator uses the same idea as an audio oscillator at a pace you perceive as movement. This design lets neighbouring waves blend continuously. [Doepfer on control signals](https://doepfer.de/a100_man/a100t_e.htm) [2hp Lfo](https://www.twohp.com/modules/p/lfo)

[Research and implementation notes](../../research/modules/lfo.md)
