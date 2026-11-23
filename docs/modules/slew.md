# Dual slew limiter

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Slew+Limiter)

1. Start the rack. SEQ sends pitch steps into channel 1 of Slew and its output tunes the triangle oscillator.
2. Start with Rate1 low, then turn it up until the wider leaps become glides. At a faster clock rate, the output may head for a new note before reaching the last one.

## In a composition

For a sliding bass line, put the limiter between the sequencer and oscillator. On a gate or switch output the same patching idea softens sudden changes in volume or timbre.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate1 (`rate1`), Rate2 (`rate2`) | Sets the response time for changes on this channel. Longer times give softer transitions. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In1 (`in1`), In2 (`in2`) | Any signal · ±10 V | The changing signal to smooth on this channel. |
| CV1 (`cv1`), CV2 (`cv2`) | Control voltage · ±5 V | Modulates the amount of slew on the corresponding channel. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out1 (`out1`), Out2 (`out2`) | Any signal · ±10 V | Carries the input after abrupt changes have been smoothed. |

## Design background

Slew limiters such as the Doepfer A-170 are general-purpose voltage processors. Portamento is one musical application of limiting how quickly a voltage can change. [Doepfer A-170 dual slew limiter](https://doepfer.de/a170.htm)

[Research and implementation notes](../../research/modules/slew.md)
