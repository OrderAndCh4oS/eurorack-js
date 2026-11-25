# Fold percussion voice

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Fold+Percussion)

1. Start the rack. Listen to the eight-step loop. SEQ strikes the drum on six steps and sends a different voltage to Fold on each one. Turn step eight down from near the top to hear its buzzy accent round off.
2. Leave the sequence running and switch Liquid to Skin. Listen to the pitch at the start of each hit. Liquid bends down into the bass note. Skin holds its pitch. Turn Harmonic and Fold down to hear the difference clearly.
3. Try Metal in Alto with Harmonic just above halfway, Spread low and a longer Decay. Listen for the metallic ring between hits. Pause CLK and press Hit to hear a single tail.

## In a composition

For a tuned kick, start in Skin/Bass, put Attack at noon, and turn Harmonic, Morph and Fold down. Tune the tail to the bass line with Pitch or V/Oct. Switch to Liquid for a harder initial knock at the same final pitch.

To play several drum sounds from one voice, use a stepped CV on the mode jack to alternate Skin, Liquid and Metal. Send a second sequence to Decay. Short rattling hits can occupy the gaps between long bass notes. Each new strike takes over the current tail.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Pitch (`pitch`) | Tunes the body across four octaves. The Bass range starts at 27.5 Hz. |
| Attack (`attack`) | Turn left from noon for a noise burst or right for a gentler onset. Noon gives a fast, pitched pop. |
| Decay (`decay`) | Sets how quickly the body rings out, from about 60 ms to 2.4 s to fall by 60 dB on a dry sine. |
| Morph (`morph`) | Moves the six oscillators from sine through triangle and saw to square. |
| Harmonic (`harmonic`) | Starts with the fundamental, brings in the second partial, then adds and lengthens the higher partials. |
| Spread (`spread`) | Moves the upper partials from the harmonic series towards odd prime multiples. Intermediate settings give inharmonic intervals. |
| Fold (`fold`) | Reflects waveform peaks for extra harmonics. Above three quarters, a narrow pulse on each crest and trough adds buzz. |
| Mode (`mode`) | Skin adds the six oscillators. Liquid adds a downward pitch sweep. Metal lets each upper oscillator modulate the frequency of its neighbour. |
| Range (`range`) | Bass uses the panel pitch. Alto raises it two octaves and Treble raises it four. |
| Hit (`hit`) | Plays one strike. The green LED flashes for each strike from Hit or Trig. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Trig (`trigger`) | Trigger | Play a strike by crossing +3 V. A held gate lets the strike ring out. |
| V/Oct (`pitchCV`) | Pitch CV | Add pitch at one octave per volt, from 0 to +8 V, up to the audio-band limit. |
| Attack (`attackCV`) | CV | Move the onset from noise towards a clean pop and then a soft strike. |
| Decay (`decayCV`) | CV | Lengthen the ringing body. |
| Morph (`morphCV`) | CV | Change the oscillator shapes. |
| Harmonic (`harmonicCV`) | CV | Bring more upper partials into the sound. |
| Spread (`spreadCV`) | CV | Widen the oscillator intervals while the fundamental stays in tune. |
| Fold (`foldCV`) | CV | Increase reflection and buzz for accents. |
| S/L/M (`modeCV`) | CV | Add zero, one or two mode positions in equal bands across 0–5 V. Selection stops at Metal. |
| B/A/T (`rangeCV`) | CV | Add zero, one or two register positions in equal bands across 0–5 V. Selection stops at Treble. |

The six timbre jacks add to their knobs throughout a hit. With a knob at zero, +2.5 V moves it halfway and +5 V takes it to maximum.

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Mono audio | Carries the struck and shaped drum at up to ±5 V, ready for a mixer or OUT. |

## Design background

Noise Engineering’s Basimilus Iteritas Alter combines six pitched oscillators, transient noise and a wavefolder. This voice follows its additive, sweeping and linear FM modes. The waveforms and folder are bandwidth-controlled for the rack’s fixed sample rate. [Research and implementation notes](../../research/modules/fold-perc.md)
