# Swing clock

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Swing)

1. Press **Start**. The straight output plays the kick and the swung output plays the hat. Both outputs also run to the scope.
2. Start with **Human** low, then increase **Swing** and listen to the space before each delayed hat. Bring up Human to add variation around that pattern.

## In a composition

For a shuffle, keep the bass or kick on the straight output and send hats or a second sequencer the swung clock. The contrast makes a small delay audible.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Swing (`swing`) | Sets how far the template pushes selected pulses behind the original clock. |
| Human (`human`) | Adds small variations to the timing of the processed pulses. |
| Width (`width`) | Sets the duration of the outgoing trigger pulses. |
| Tmpl (`template`) | Chooses the pattern of timing offsets applied across successive pulses. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Clk (`clock`) | Trigger · 0 to 10 V | Supplies the straight clock that both outputs follow. |
| Rst (`reset`) | Trigger · 0 to 10 V | Restarts the template at its first position. |
| SwCV (`swingCV`) | Control voltage · 0 to 5 V | Modulates the amount of swing so a groove can change between phrases. |
| HmCV (`humanCV`) | Control voltage · 0 to 5 V | Modulates the strength of the timing variation. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Swg (`swung`) | Trigger · 0 to 10 V | Carries pulses with the selected template and timing variation applied. |
| Str (`straight`) | Trigger · 0 to 10 V | Carries immediate reference pulses for a part that stays on the grid. |

## Design background

This design adapts the timing templates and humanisation of drum machines to clock cables. A destination can inherit a groove without changing its notes. [4ms Shuffling Clock Multiplier](https://4mscompany.com/scm.php)

[Research and implementation notes](../../research/modules/swing.md)
