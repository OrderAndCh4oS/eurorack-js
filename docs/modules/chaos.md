# Chaotic modulation source

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Chaos)

1. Start the rack. X and Y feed the scope while Z modulates the oscillator’s frequency. Compare what you hear to the two traces as the system moves.
2. Turn Rate down to follow the contours. Increase Character and watch how the motion changes, then reduce Depth if the pitch excursion becomes wider than you want.

## In a composition

For a slowly shifting landscape, send X to a filter and Y to a pan or effects control. The Lobe gate can mark larger changes of state with a percussion hit.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate (`rate`) | Sets how fast the system travels through its trajectory. |
| Character (`character`) | Changes the behaviour of the underlying system and the shape of its motion. |
| Depth (`depth`) | Scales the excursion of the continuous voltage outputs. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Rate (`rateCV`) | Control voltage · ±5 V | Changes the speed of the motion from another voltage. |
| Char (`characterCV`) | Control voltage · ±5 V | Changes the system’s character during a phrase. |
| Reset (`reset`) | Trigger · 0 to 10 V | Returns the system to its defined starting state. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| X (`x`), Y (`y`), Z (`z`) | Control voltage · ±5 V | Supplies this coordinate of the same evolving system. Patch different coordinates to parameters that should move in related ways. |
| Lobe (`lobe`) | Gate · 0 to 10 V | Provides a gate indicating the active side of the trajectory. |

## Design background

This source follows the Lorenz equations. Their three interacting variables generate continuous trajectories, giving the patch a different kind of motion from a clock choosing new random values.

[Research and implementation notes](../../research/modules/chaos.md)
