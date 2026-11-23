# Granulita granular chord generator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Granulita)

1. Start the patch in stereo. A saw enters the left input, an LFO moves the grain pitch and a clock hits the Hit jack. The two outputs carry the granular chord.
2. Try a different Chord, then shorten Length and adjust Count. Listen for individual grain attacks at one setting and a smoother continuous texture at another.

## In a composition

For an ambient chord bed, use long overlapping grains and add Verb. For a rhythmic texture, choose shorter grains and patch a repeating trigger pattern to Hit.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Blend (`blend`) | Balances the input and granular sound. |
| Pitch (`pitch`) | Transposes the grains relative to the captured source. |
| Chord (`chord`) | Selects the interval set that the grain voices play. |
| Voice (`voice`) | Selects which of the four grain voices follows the root, changing how the other chord tones sit around it. |
| Verb (`verb`) | Adds the internal reverberated tail. |
| Count (`count`) | Sets grain density, changing how many fragments overlap. |
| Length (`length`) | Sets the duration of individual grains. |
| Dir (`direction`) | Chooses reverse grains, a mixture of directions, or forward grains. |
| Hit (`hitMode`) | Assigns the Hit jack to freeze capture, synchronize grain timing or trigger grains. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In L (`inL`), In R (`inR`) | Audio | Feeds this side of the material to be granulated. |
| Hit (`hit`) | Gate | Receives the gate or pulse used by the selected Hit mode. |
| Blend (`blendCV`) | Control voltage · 0 to 5 V | Moves the dry/granular balance. |
| Pitch (`pitchCV`) | Control voltage · 0 to 5 V | Transposes the grains from an external control voltage. |
| Chord (`chordCV`) | Control voltage · 0 to 5 V | Selects different chord shapes under voltage control. |
| Voice (`voiceCV`) | Control voltage · 0 to 5 V | Changes chord voicing under voltage control. |
| Verb (`verbCV`) | Control voltage · 0 to 5 V | Changes the internal reverb amount. |
| Count (`countCV`) | Control voltage · 0 to 5 V | Changes the density of grains. |
| Length (`lengthCV`) | Control voltage · 0 to 5 V | Changes individual grain duration. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out L (`outL`), Out R (`outR`) | Audio | Carries this side of the stereo granular chord and reverb blend. |

## Design background

Noise Engineering’s Granulita Versio inspired the pairing of granular resynthesis with chord voicing. The source sound supplies the material that each pitched grain replays. [Noise Engineering Granulita Versio](https://noiseengineering.us/products/granulita-versio/)

[Research and implementation notes](../../research/modules/granulita.md)
