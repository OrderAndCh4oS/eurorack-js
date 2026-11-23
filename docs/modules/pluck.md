# Plucked string voice

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Pluck)

1. Start the rack. The clock advances SEQ and strikes Pluck on every beat. The sequencer’s CV changes the tuning of each strike.
2. Extend Decay, then turn Damp up. Listen for the difference between how long the string rings and how quickly its bright edge softens. Move Pos to change the colour of the attack.

## In a composition

For a picked bass ostinato, keep the decay short enough to leave space between notes. Two differently damped plucks playing a call and response can suggest two players.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Pitch (`pitch`) | Sets the string’s base pitch before a note voltage is applied. |
| Decay (`decay`) | Sets how long a struck string rings. |
| Damp (`damp`) | Changes how quickly high frequencies die away from the vibrating string. |
| Pos (`position`) | Moves the virtual picking point, changing the balance of harmonics in the attack. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Trig (`trigger`) | Trigger · 0 to 10 V | Plucks a new string voice on a rising edge. Successive notes can overlap. |
| V/O (`vOct`) | Control voltage · ±8 V | Tunes each note at one volt per octave. |
| Dcy (`decayCV`) | Control voltage · ±5 V | Varies ringing time from strike to strike. |
| Dmp (`dampCV`) | Control voltage · ±5 V | Varies the damping of each new strike. |
| Pos (`positionCV`) | Control voltage · ±5 V | Moves the picking point under voltage control. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the combined sound of the ringing strings. |

## Design background

The Karplus–Strong model starts a short delay loop with noise, then filters the circulating sound. The loop’s length sets pitch and the losses shape the decay. [Karplus and Strong’s original paper](https://users.soe.ucsc.edu/~karplus/papers/digitar.pdf)

[Research and implementation notes](../../research/modules/pluck.md)
