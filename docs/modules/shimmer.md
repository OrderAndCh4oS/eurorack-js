# Shimmer reverb

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Shimmer)

1. Start the rack. A clocked stereo ensemble feeds two Shimmer modules in parallel. Each has its own spectrum display and both reach the stereo mixers.
2. On both mixers turn channel 2 down to isolate the input-shifted reverb. Restore it and turn channel 1 down on both to hear the regenerating version. Listen to how the pitch builds as the chord dies away.

## In a composition

For a slow transition, set a rising interval and let a short chord fall silent while the reverb continues. A little damping keeps successive layers from overwhelming the next phrase.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| DECAY (`decay`) | Sets how long the reverb tail persists. |
| SIZE (`size`) | Changes the apparent size of the space by scaling its internal delays. |
| DIFF (`diffusion`) | Changes how densely the reflections spread together. |
| PRE (`preDelay`) | Sets the gap between the dry attack and the reverberation. |
| DAMP (`damp`) | Removes high frequencies progressively from the tail. |
| MOD (`modDepth`) | Sets the internal delay modulation that animates the tail. |
| INT (`interval`) | Selects the pitch-shift interval in semitones. |
| SHIM (`shimmer`) | Sets how strongly the shifted signal contributes to the reverberation. |
| MIX (`mix`) | Sets the balance of dry stereo input and reverb. |
| INPUT / REGEN (`route`) | Places pitch shifting on the input or in the regenerating feedback path. |
| FREEZE (`freeze`) | Holds the current reverberating sound. |
| CLEAR (`clear`) | Empties the reverb tail from the panel. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| IN L (`inL`), IN R (`inR`) | Audio · ±5 V | Feeds this side of the stereo reverb. |
| DECAY (`decayCV`) | Control voltage · ±5 V | Varies the reverberation time. |
| DAMP (`dampCV`) | Control voltage · ±5 V | Changes high-frequency loss in the tail. |
| SHIM (`shimmerCV`) | Control voltage · ±5 V | Changes the amount of pitch-shifted signal. |
| INT (`intervalCV`) | Control voltage · ±5 V | Moves the pitch-shift interval under voltage control. |
| MIX (`mixCV`) | Control voltage · ±5 V | Changes the dry/wet blend. |
| FREEZE (`freezeGate`) | Gate · 0 to 10 V | Holds the reverberation from an external gate. |
| CLEAR (`clearTrig`) | Trigger · 0 to 10 V | Clears the tail on a trigger. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| OUT L (`outL`), OUT R (`outR`) | Audio · ±5 V | Carries the corresponding side of the stereo dry/reverb mix. |

## Design background

Pitch-shifted reverberation combines two studio treatments. Returning the shifted signal to the reverb makes the effect of the selected interval accumulate.

[Research and implementation notes](../../research/modules/shimmer.md)
