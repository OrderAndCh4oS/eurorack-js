# Matrix mixer

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Matrix+Mixer)

1. Start the demo. Triangle and pulse enter inputs 1 and 2. Output A sends their mixture to the VCA’s audio input, while B supplies its control signal from the LFO on input 3.
2. Turn 2>A down and 1>A up to favour the softer triangle. Then adjust 3>B to change how strongly the LFO opens the VCA while keeping your audio blend.

## In a composition

For a dub arrangement, give a dry mix, a delay send and a reverb send their own columns. Turn up one crosspoint to send a particular instrument into the echo.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| 1>A (`a1`), 2>A (`a2`), 3>A (`a3`), 4>A (`a4`) | Sets how much of the numbered input reaches mix A. |
| 1>B (`b1`), 2>B (`b2`), 3>B (`b3`), 4>B (`b4`) | Sets how much of the numbered input reaches mix B. |
| 1>C (`c1`), 2>C (`c2`), 3>C (`c3`), 4>C (`c4`) | Sets how much of the numbered input reaches mix C. |
| 1>D (`d1`), 2>D (`d2`), 3>D (`d3`), 4>D (`d4`) | Sets how much of the numbered input reaches mix D. |
| A Pol (`modeA`), B Pol (`modeB`), C Pol (`modeC`), D Pol (`modeD`) | Sets the polarity of this column’s four gain knobs. Unipolar fades up from zero. Bipolar puts silence in the centre and inverted gain to its left. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In1 (`in1`), In2 (`in2`), In3 (`in3`), In4 (`in4`) | Any signal · ±10 V | Feeds this numbered row. Its four knobs can send the same audio or control voltage to different outputs. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| A (`outA`), B (`outB`), C (`outC`), D (`outD`) | Any signal · ±10 V | Carries the sum set by the four knobs in the matching column. |

## Design background

Manual matrix mixers such as the Doepfer A-138m inspired the grid. Keeping each column independent also makes the panel useful for mixing control voltages. [Doepfer A-138m matrix mixer](https://doepfer.de/a138m.htm)

[Research and implementation notes](../../research/modules/matrix.md)
