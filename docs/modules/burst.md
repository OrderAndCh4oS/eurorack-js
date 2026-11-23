# Burst generator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Burst)

1. Start the patch. CLK goes to both Ping and Trig. The burst output plays the kick, and the end-of-cycle output marks the end of the group with a hat.
2. Change **Qty** to count the kick strikes, then adjust **Dist** to bunch them toward one end. Compare the tempo and burst traces on the scope.

## In a composition

For a fill, trigger a burst only on the last step of a bar. Send its end pulse to a different drum to mark the downbeat that follows.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Tempo (`tempo`) | Sets the internal tempo used to space bursts when there is no ping timing reference. |
| Qty (`quantity`) | Sets the number of pulses scheduled for a burst. |
| Q CV (`quantityCvAmount`) | Scales the influence of the Qty CV jack on the pulse count. |
| Dist (`distribution`) | Moves the pulses closer together toward the start or the end of the burst. |
| Time (`timeFactor`) | Scales the duration of the burst window relative to the tempo. |
| Prob (`probability`) | Sets the chance that scheduled burst pulses are emitted. |
| Cycle (`cycle`) | Starts another burst automatically at the end of the window. |
| First (`includeFirstPulse`) | Includes a pulse at the start, useful when the triggering beat should also sound. |
| Retrig (`retrigger`) | Allows a new trigger to restart a burst already in progress. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Trig (`trig`) | Trigger · 0 to 10 V | Starts a burst on a rising pulse. |
| Ping (`ping`) | Trigger · 0 to 10 V | Uses the time between incoming pulses to set a tempo reference. |
| Qty (`quantityCv`) | Control voltage · ±5 V | Changes how many pulses the burst schedules, scaled by Q CV. |
| Dist (`distributionCv`) | Control voltage · ±5 V | Modulates the spacing contour across a burst. |
| Time (`timeCv`) | Control voltage · ±5 V | Changes the burst’s time factor relative to its tempo reference. |
| Prob (`probabilityCv`) | Control voltage · ±5 V | Modulates the likelihood of emitting scheduled pulses. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Trigger · 0 to 10 V | Sends the individual pulses of the burst. |
| Tempo (`tempo`) | Trigger · 0 to 10 V | Provides the master timing pulse for the current tempo. |
| EOC (`eoc`) | Trigger · 0 to 10 V | Sends a pulse at the end of a burst cycle. |

## Design background

Pingable burst generators take their time from incoming taps. They let a single event carry an internal rhythm while remaining tied to the larger pulse. [Befaco Burst](https://www.befaco.org/burst-2/)

[Research and implementation notes](../../research/modules/burst.md)
