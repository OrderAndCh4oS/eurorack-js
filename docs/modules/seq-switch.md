# Sequential switch

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Sequential+Switch)

1. Start the rack. Each clock selects one of four inputs. Triangle, saw, pulse and noise take turns at Common Out, which feeds a VCA and both speakers.
2. Turn Steps down to two. The alternation narrows to the first two timbres. Replace either input in Edit to audition a different pair at the same clock rate.

## In a composition

For a hocket, connect a melody to Common In and send the numbered outputs to different instruments. For a rotating drum accent, switch between several trigger patterns instead.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Steps (`steps`) | Sets the cycle length to two, three or four stages. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Clk (`clock`) | Trigger · 0 to 10 V | Selects the next stage on each pulse. |
| Rst (`reset`) | Trigger · 0 to 10 V | Returns the selector to the first stage. |
| Com In (`commonIn`) | Any signal · ±5 V | Signal to distribute to the numbered output of the active stage. |
| In1 (`in1`), In2 (`in2`), In3 (`in3`), In4 (`in4`) | Any signal · ±5 V | Signal to place on Common Out when this numbered stage is active. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Com Out (`commonOut`) | Any signal · ±5 V | Carries the currently selected numbered input. |
| Out1 (`out1`), Out2 (`out2`), Out3 (`out3`), Out4 (`out4`) | Any signal · ±5 V | Passes Common In while this stage is selected and rests at zero otherwise. |

## Design background

An electronic switch can play the role of a musician moving a patch cord in time. This one exposes both the many-to-one and one-to-many paths.

[Research and implementation notes](../../research/modules/seq-switch.md)
