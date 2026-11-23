# Pulse-width modulator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+PWM)

1. Start the patch. The first scope shows the oscillator’s triangle and a slower LFO. PWM uses the triangle as its source and the LFO to change pulse width. The second scope shows the pulse you hear.
2. Turn PWM down to stop the sweep and move PW by hand. Watch the high portion of each cycle get wider or narrower, then restore the LFO depth.

## In a composition

For a string-like lead, use a slow, shallow width sweep. Keep the width away from the extremes when you want the pulse to remain audible throughout the cycle.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| PW (`pw`) | Sets the comparison threshold and therefore the fraction of each waveform cycle that is high. |
| PWM (`pwmAmt`) | Sets how strongly the PWM CV input moves pulse width. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`in`) | Audio | Supplies the changing waveform to convert to a pulse. |
| PWM (`pwmCV`) | Control voltage · ±5 V | Moves pulse width under external control. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the resulting pulse wave. |
| Inv (`inv`) | Audio | Carries the opposite polarity of the pulse output. |

## Design background

Inspired by the Doepfer A-168-1, this module creates pulse width by comparing a changing input against an adjustable threshold. The source can also be a slow control signal. [Doepfer A-168-1 pulse-width modulator](https://doepfer.de/a1681.htm)

[Research and implementation notes](../../research/modules/pwm.md)
