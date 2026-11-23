# Ensemble oscillator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Ensemble+VCO)

1. Start the rack in stereo. The two ensemble outputs go directly to the two speakers. An LFO slowly changes Spread, moving voices across the selected scale.
2. Bring Spread near its minimum, then open it again. Compare Detune, which makes close voices beat, with Spread, which separates their notes.

## In a composition

For a string-like pad, use a small amount of detuning with a slow stereo swell. For a harmonic drone, freeze part of the ensemble and move the others around it.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Root (`root`) | Sets the ensemble’s base tuning around which scale notes are chosen. |
| Pitch (`pitch`) | Transposes the whole ensemble after the notes have been assigned. |
| Fine (`fine`) | Adjusts the ensemble’s fine tuning. |
| Spread (`spread`) | Opens the spacing between voices across the chosen scale. |
| Scale (`scale`) | Chooses a scale slot from the current group. |
| Detune (`detune`) | Offsets voices slightly from one another to create beating and thickness. |
| Voices (`oscillatorCount`) | Selects how many oscillators participate, from one to sixteen. |
| Balance (`balance`) | Changes which part of the oscillator bank dominates the mix. |
| XFade (`crossfade`) | Adjusts how smoothly voices travel between neighbouring scale pitches. |
| Cross FM (`crossFm`) | Lets oscillators modulate one another’s frequency for a rougher or richer tone. |
| Twist (`twist`) | Distorts the motion of oscillator phase and changes each voice’s harmonic colour. |
| Warp (`warp`) | Reshapes the waveform to add a further layer of harmonics. |
| Note (`learnNote`) | Selects the note to add to or delete from the current scale slot. |
| Group (`scaleGroup`) | Chooses the group of scales available to the Scale control. |
| FM Mode (`crossFmMode`) | Chooses the modulation source for the bank. The three positions use the first voice, the preceding voice in a chain, or the last voice. |
| Twist Mode (`twistMode`) | Chooses the phase-shaping method used by Twist. |
| Warp Mode (`warpMode`) | Chooses the waveform-shaping method used by Warp. |
| Stereo (`stereoMode`) | Splits voices across A and B by alternating voices, by lower and upper halves, or by isolating the first voice on A. |
| Freeze Mode (`freezeMode`) | Selects the first voice, the lower half of the bank, or alternate voices to hold at their current pitches. |
| Freeze (`freeze`) | Holds the tuning of that group while the other voices continue to follow the controls. |
| Learn (`learnMode`) | Enables learning notes for the selected scale. |
| Add (`addNote`) | Adds the selected note to the current learned scale. |
| Delete (`deleteNote`) | Removes the selected note from the current learned scale. |
| Factory (`resetScale`) | Restores the factory notes for the current scale slot. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Root (`root`) | Control voltage · ±5 V | Shifts the root used for finding the ensemble’s notes. |
| Pitch (`pitch`) | Control voltage · ±5 V | Transposes the sounding voices at one volt per octave. |
| Scale (`scaleCv`) | Control voltage · ±5 V | Changes the selected scale within its group. |
| Spread (`spreadCv`) | Control voltage · ±5 V | Opens or closes the spread of scale notes. |
| Balance (`balanceCv`) | Control voltage · ±5 V | Shifts emphasis through the oscillator bank. |
| Cross FM (`crossFmCv`) | Control voltage · ±5 V | Changes the intensity of cross-modulation. |
| Twist (`twistCv`) | Control voltage · ±5 V | Modulates the amount of phase shaping. |
| Warp (`warpCv`) | Control voltage · ±5 V | Modulates the amount of waveform shaping. |
| Learn (`learn`) | Trigger · 0 to 10 V | Adds the current pitch to the scale on a trigger while Learn is active. |
| Freeze (`freeze`) | Trigger · 0 to 10 V | Toggles the held voice group from an external pulse. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Mono (`mono`) | Audio | Combines the ensemble into one audio signal. |
| A (`outA`), B (`outB`) | Audio | Carries this side of the ensemble according to the selected stereo distribution. |

## Design background

The scale-based oscillator bank is inspired by the 4ms Ensemble Oscillator, designed with Matthias Puech. Its combination of closely spaced tones and quantized intervals suggests both additive tones and chords. [4ms Ensemble Oscillator](https://4mscompany.com/enosc.php)

[Research and implementation notes](../../research/modules/ensemble-vco.md)
