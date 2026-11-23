# Monophonic pitch tracker

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Pitch+Tracker)

1. Start the patch in stereo. The sequencer plays a triangle on the left. Its signal also goes through a VCA to the tracker. Pitch tunes a second oscillator and Gate opens its VCA on the right.
2. Lower the source-level VCA while watching the scope’s Gate trace. The right-hand voice closes when the tracker loses a valid note. Raise the level and try Smooth to soften the tracked pitch movement.

## In a composition

For a doubled lead, feed the tracker one clean melodic line and tune a second voice to a complementary interval. The validity gate is useful for keeping pauses quiet.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| MIN LEVEL (`level`) | Sets the minimum audio level the detector will accept. Increase it to reject quiet noise. |
| SMOOTH (`smooth`) | Sets smoothing time in milliseconds for pitch movement after detection. |
| FAST / LOW (`range`) | Chooses faster response or a lower tracking range for bass notes. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| IN (`audio`) | Audio · ±5 V | Supplies a single pitched audio voice for analysis. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| PITCH (`pitch`) | Control voltage · ≈ −2.67 to 3 V | Sends the detected note at one volt per octave and holds the last estimate between valid readings. |
| GATE (`gate`) | Gate · 0 to 10 V | Stays high when a valid pitch is detected. Use it to close a following voice during rests. |

## Design background

Pitch following estimates a repeating period in audio and converts it to the one-volt-per-octave convention. Holding the last estimate while validity falls keeps the pitch output useful between notes.

[Research and implementation notes](../../research/modules/pitch-track.md)
