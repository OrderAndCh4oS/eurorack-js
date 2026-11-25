# Slice sampler

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Slice+Sampler)

1. Start audio. The clock triggers a four-hit drum phrase on the left. On the right, Euclid picks three of every eight clock pulses to play a bell phrase backward. Move Hits on Euclid to bring the bells closer together. The factory bells use slightly detuned pitches and an inharmonic partial for a metallic attack.
2. Select Player B and change Playback from Reverse to Forward. The bell attacks return to the beginning of each hit. Change Order to Forward as well and hear the four pitches walk in the opposite order.
3. Choose Address on Player A and turn Slice to 3. Each clock now repeats the closed hat. Connect a stepped 0–5 V signal to CV 2 A to choose a different hit on the next trigger. Stop the clock to audition single hits with the Audition button.

## In a composition

Import a percussion loop on A and a sustained chord on B. Use Zero to put drum cuts near sign changes that soften abrupt edges. On B, select Address and Fwd loop to sustain one piece of the chord under the drums. Patch a sequencer’s 1 V/oct output into CV 1 B to transpose it, then use Stop to release the loop.

To make your own take, patch a mono source into Rec in and press Record while audio is running. The red light stays on during capture. Press Record again to finish, or let it reach the 30-second limit. Finishing selects Local. The previous sample remains playable during recording. Stopping rack audio also retains the recorded prefix. Select Local to play it when you restart. Local audio survives audio stop/start in this rack session. A reopened or copied patch keeps the cuts and control settings and asks you to load the WAV again.

## Panel reference

Player A and Player B select the editor. Both jack banks and both pairs of lights remain visible. Green shows playback activity and red shows recording. Import WAV accepts mono or stereo 16-bit PCM at 8–96 kHz, up to 8,388,608 frames. Stereo channels are averaged. The display shows the selected sound, its duration and an overview of the waveform.

To edit a cut, click the waveform or type a cursor percentage. Add makes a new start there. Choose an interior cut by number, place the cursor and press Move, or press Remove. Editing a Grid or Zero partition copies its starts into Manual. The beginning and end of the sample are fixed. The waveform overview samples long files at a reduced resolution.

### Controls

| Panel | What it does |
| --- | --- |
| Source A / B (`sourceA`, `sourceB`) | Selects the factory phrase or the player’s local WAV or recording. |
| Tune A / B (`tuneA`, `tuneB`) | Transposes playback continuously from −24 to +24 semitones. Zero preserves the recorded pitch. |
| Level A / B (`levelA`, `levelB`) | Scales amplitude from silence to unity. |
| Playback A / B (`playModeA`, `playModeB`) | Plays a slice once or loops it, forward or in reverse. The next trigger latches the choice. |
| Order A / B (`orderA`, `orderB`) | Advances, walks backward, chooses a random region or uses Address on each hit. |
| Slice A / B (`sliceA`, `sliceB`) | Selects the base region in Address mode, numbered from 1. Values above the region count select the last one. |
| Count A / B (`countA`, `countB`) | Sets 1–32 equal-length regions for Grid and Zero. |
| Slice method A / B (`methodA`, `methodB`) | Grid spaces cuts evenly, Zero seeks nearby sign changes and Manual uses your saved positions. |
| CV 1 A / B (`assign1A`, `assign1B`) | Assigns CV 1 to Pitch (default), Slice, Level, Reverse or Off. |
| CV 2 A / B (`assign2A`, `assign2B`) | Assigns CV 2. The default is Slice. |
| CV 3 A / B (`assign3A`, `assign3B`) | Assigns CV 3. The default is Off. |
| Audition A / B (`auditionA`, `auditionB`) | Triggers the next hit using this player’s current order and playback mode. |
| Stop A / B (`stopA`, `stopB`) | Releases the voice and restarts its traversal sequence on the next hit. |
| Record A / B (`recordA`, `recordB`) | Starts or finishes a mono recording from Rec in on the corresponding player. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Trig A / B (`trigA`, `trigB`) | Trigger | A rising edge at 1 V plays the chosen region. A held gate produces one hit. |
| CV 1 A / B (`cv1A`, `cv1B`) | CV | Defaults to pitch at 1 V/oct. Total transposition is limited to four octaves in either direction. |
| CV 2 A / B (`cv2A`, `cv2B`) | CV | Defaults to Address slice selection. A 0–5 V input offsets the Slice dial across the available regions. |
| CV 3 A / B (`cv3A`, `cv3B`) | CV | Defaults to Off. All three CV inputs share the same destinations. Level adds unity at +5 V. Reverse toggles the panel direction when any assigned input is at least 1 V on a trigger. |
| Rec in A / B (`recA`, `recB`) | Audio | Records the incoming mono signal at the rack sample rate, clipped to ±5 V. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out A / B (`outA`, `outB`) | Audio | Delivers each independent mono voice at up to ±5 V. |

## Design background

Erica Synths’ Sample Drum combines two triggered mono voices with independent sample slicing and assignable modulation. This adaptation supplies two original factory phrases and a dedicated recording input per voice. Playback uses linear interpolation and short transitions at slice boundaries. [Research and implementation notes](../../research/modules/slice-sampler.md)
