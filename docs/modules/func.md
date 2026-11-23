# Function generator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Func+Envelope)

1. Start the patch. Clock pulses trigger Func and its output travels through an attenuverter to the VCA. You hear that curve as the loudness of a triangle wave.
2. Lengthen Rise until the attack swells into the note. Shorten Fall to bring it to an abrupt end. Move Curve to hear a different contour with the same timing knobs.

## In a composition

For a bouncing bass envelope, use a quick rise and an audible fall. For repeating filter motion, engage Cycle and patch Out to a filter instead.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rise (`rise`) | Sets how long the contour takes to climb, or how quickly a rising input is followed. |
| Fall (`fall`) | Sets how long the contour takes to descend, or how quickly a falling input is followed. |
| Curve (`curve`) | Changes the bend of the transitions between their endpoints. |
| Cycle (`cycle`) | Restarts the contour after each fall for a repeating modulation signal. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`in`) | Control voltage · 0 to 10 V | Signal to follow with the chosen rise and fall times. Patch stepped pitch here for slides. |
| Trig (`trig`) | Trigger · 0 to 10 V | Starts a rise/fall envelope from a short pulse. |
| R CV (`riseCV`) | Control voltage · ±5 V | Changes the rise time under voltage control. |
| F CV (`fallCV`) | Control voltage · ±5 V | Changes the fall time under voltage control. |
| Cyc (`cycleCV`) | Gate · 0 to 10 V | Engages cycling from a high gate. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Control voltage · 0 to 10 V | Supplies the generated contour or the smoothed input. |
| Inv (`inv`) | Control voltage · 0 to 10 V | Supplies the inverted contour for complementary movement. |
| EOR (`eor`) | Gate · 0 to 10 V | Marks the end of the rise, when the contour begins to fall. |
| EOC (`eoc`) | Gate · 0 to 10 V | Marks the end of the complete cycle. Use it to trigger another event. |

## Design background

Rise/fall generators combine several jobs by exposing a contour and pulses at its turning points. Make Noise Maths is a hardware example of this patching vocabulary. [Make Noise Maths](https://www.makenoisemusic.com/modules/maths/)

[Research and implementation notes](../../research/modules/func.md)
