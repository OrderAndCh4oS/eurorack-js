# Dual window comparator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+CMP2)

1. Start the patch. Two different Øchd speeds enter the two windows. The OR output gates an envelope, opening the VCA on a filtered triangle whenever either window is occupied.
2. Narrow one Size and move its Shift. Listen for changes in note length and timing as the LFO spends less time inside that region. Compare OR with AND at the ADSR gate.

## In a composition

For a generative rhythm, turn slow modulation into pulses, then use the coincidence output for accents. Window width is a way to compose with note length as well as onset.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Shift (`shift1`), Shift (`shift2`) | Moves the centre of this channel’s comparison window. |
| Size (`size1`), Size (`size2`) | Sets the width of this channel’s window. A wider window usually stays active longer. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`in1`), In (`in2`) | Control voltage | The voltage this comparator checks against its window. |
| Sh (`shiftCV1`), Sh (`shiftCV2`) | Control voltage | Moves the corresponding window’s centre under voltage control. |
| Sz (`sizeCV1`), Sz (`sizeCV2`) | Control voltage | Changes the corresponding window’s width. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out1`), Out (`out2`) | Gate | High while this channel’s input lies inside its window. |
| Not (`not1`), Not (`not2`) | Gate | High while this channel’s input lies outside its window. |
| AND (`and`) | Gate | High while both windows are active. |
| OR (`or`) | Gate | High while either or both windows are active. |
| XOR (`xor`) | Gate | High while exactly one of the two windows is active. |
| FF (`ff`) | Gate | Toggles state when XOR rises, turning successive events into alternating gate states. |

## Design background

The paired windows and logic section draw on Joranalogue Compare 2. Comparing voltages gives a continuous performance gesture distinct rhythmic boundaries. [Joranalogue Compare 2](https://joranalogue.com/products/compare-2)

[Research and implementation notes](../../research/modules/cmp2.md)
