# Stereo reverb

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Reverb)

1. Start the demo. A clocked envelope opens both the filter and VCA on a saw wave. That short mono note enters the left input and the reverb returns in stereo.
2. Increase Time until the tail crosses the following note. Turn Damp up to darken what lingers, then adjust Mix to place the original attack closer or farther away.

## In a composition

For a sparse melody, leave room between phrases for a long tail. With a busy part, shorten Time and use damping to keep the details of the rhythm audible.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Time (`time`) | Sets how long the room rings after the input stops. |
| Damp (`damp`) | Controls high-frequency loss in the tail. More damping gives a darker space. |
| Mix (`mix`) | Sets the proportion of direct sound and reverberation. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| L (`audioL`) | Audio | Feeds the left input. A single mono source here can produce a stereo return. |
| R (`audioR`) | Audio | Feeds a separate right-hand signal for stereo input. |
| Mix (`mixCV`) | Control voltage | Changes the amount of reverberation under voltage control. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| L (`outL`), R (`outR`) | Audio | Carries the matching side of the stereo reverberated mix. |

## Design background

The panel follows the compact approach of 2hp Verb. A stereo field can grow from a single mono source because the two reverb returns develop differently. [2hp Verb](https://www.twohp.com/modules/p/verb)

[Research and implementation notes](../../research/modules/verb.md)
