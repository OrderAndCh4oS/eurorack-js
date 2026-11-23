# Joystick controller

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Joystick+Controller)

1. Start the patch and drag the pad sideways. X moves the filter cutoff. Move vertically and Y changes the VCA level. Both movements also appear on the scope.
2. Press Rec, draw a slow circle, finish recording and play it back. Listen for the difference between opening the filter at the top of the volume swell and opening it near silence.

## In a composition

For a live drone, put brightness on one axis and volume on the other. A looping figure can keep one hand’s phrasing alive while you tune the next voice.

## Panel reference

Drag the pad to perform X and Y together. The X and Y assignment targets bind a MIDI controller to either axis.

### Controls

| Panel | What it does |
| --- | --- |
| X (`x`) | Sets horizontal position. Dragging the pad left or right changes the same axis. |
| Y (`y`) | Sets vertical position. Dragging the pad up or down changes the same axis. |
| CV1 (`cv1Amt`), CV2 (`cv2Amt`) | Sets the amount and direction of the corresponding CV input. The centre removes its influence. |
| Range (`range`) | Chooses bipolar or unipolar voltage for the X and Y outputs. |
| Move (`sense`) | Enables movement sensing for gate and trigger generation. |
| CV (`cvMode`) | Assigns the two CV inputs to horizontal/vertical movement, angle/radius, or scanning a recorded gesture. |
| Loop (`loopMode`) | Selects one-shot (1), continuous loop (L) or triggered one-shot (T) playback. |
| Gate (`gateButton`) | Sends a manual gate while held. Use it to articulate a note during a gesture. |
| Rec (`record`) | Starts and finishes recording stick movement and gate gestures. |
| Play (`play`) | Starts or stops the recorded gesture. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| CV1 (`cv1`) | Control voltage · ±5 V | Moves the X coordinate, sets polar angle, or scans the stored gesture according to CV mode. |
| CV2 (`cv2`) | Control voltage · ±5 V | Moves the Y coordinate, sets polar radius, or curves the gesture scan. |
| Trig (`trigger`) | Trigger · 0 to 10 V | Starts playback of the recorded gesture, or begins recording when the record control is armed. |
| Rst (`reset`) | Trigger · 0 to 10 V | Returns gesture playback to its starting position. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| X (`x`) | Control voltage · −5 to 10 V | Carries the horizontal position as a voltage. |
| Y (`y`) | Control voltage · −5 to 10 V | Carries the vertical position as a voltage. |
| A (`a`), B (`b`), C (`c`), D (`d`) | Control voltage · 0 to 10 V | Supplies the level for this corner of the pad. Move toward that corner to increase its contribution. |
| Gate (`gate`) | Gate · 0 to 10 V | Carries the held gate from the performance or recorded gesture, including enabled movement sensing. |
| Trig (`trig`) | Trigger · 0 to 10 V | Sends a brief pulse at the start of a gate event. |

## Design background

This performance controller draws on the Intellijel Planar and Flight of Harmony Choices tradition of using two dimensions of movement to conduct a patch. [Intellijel Planar 2](https://intellijel.com/shop/eurorack/planar-2/)

[Research and implementation notes](../../research/modules/joystick.md)
