# Archived musical patches

The collection contains 38 musical examples: the 37 examples formerly bundled into the factory selector, plus the Introduction demo. They include 28 demos, four sound effects, and six drum compositions. The dedicated Test patches view contains the separate 75 module and integration test patches.

[Download the importable patch collection](patches.json). Save the JSON file and use **Import** in the app to add the collection to this browser. Collection import does not replace the current rack. Use **Save a copy** to place a chosen patch in your account.

The export uses the existing `eurorack-js/patch-export` version 1 envelope and version 3 patch state. It preserves all names, parameters, module placements, cables, and MIDI mappings. Audio recordings and runtime buffers are not part of patch exports.

## Retained source files

Source files stay at their original paths so research links, imports, and regression fixtures remain valid. The complete `FACTORY_PATCHES` aggregate includes both tests and archived examples; normal library code imports only `TEST_PATCHES`.

| Patch | Source |
| --- | --- |
| Introduction | [demo-introduction.js](../../src/js/config/patches/demo-introduction.js) |
| Demo - Melodic Arp | [demo-melodic-arp.js](../../src/js/config/patches/demo-melodic-arp.js) |
| Demo - Pulsing Bass | [demo-pulsing-bass.js](../../src/js/config/patches/demo-pulsing-bass.js) |
| Demo - S&H Random | [demo-sh-random.js](../../src/js/config/patches/demo-sh-random.js) |
| Demo - Filter Envelope | [demo-filter-envelope.js](../../src/js/config/patches/demo-filter-envelope.js) |
| Demo - Evolving Drone | [demo-evolving-drone.js](../../src/js/config/patches/demo-evolving-drone.js) |
| Demo - Drum and Bass | [demo-drum-and-bass.js](../../src/js/config/patches/demo-drum-and-bass.js) |
| Demo - Dub Delay | [demo-dub-delay.js](../../src/js/config/patches/demo-dub-delay.js) |
| Demo - Ambient Pad | [demo-ambient-pad.js](../../src/js/config/patches/demo-ambient-pad.js) |
| Demo: Trip-Hop | [demo-trip-hop.js](../../src/js/config/patches/demo-trip-hop.js) |
| Demo - Techno | [demo-techno.js](../../src/js/config/patches/demo-techno.js) |
| Demo - Neon Grid | [demo-neon-grid.js](../../src/js/config/patches/demo-neon-grid.js) |
| Demo - Round Robin - Alternating Voices | [demo-round-robin-voices.js](../../src/js/config/patches/demo-round-robin-voices.js) |
| Demo - Synth Voice 01 - Subtractive | [demo-synth-voice-01-subtractive.js](../../src/js/config/patches/demo-synth-voice-01-subtractive.js) |
| Demo - Synth Voice 02 - Waveform Blend | [demo-synth-voice-02-waveform-blend.js](../../src/js/config/patches/demo-synth-voice-02-waveform-blend.js) |
| Demo - Synth Voice 03 - Tracked FM | [demo-synth-voice-03-tracked-fm.js](../../src/js/config/patches/demo-synth-voice-03-tracked-fm.js) |
| Demo - Synth Voice 04 - Sync Sweep | [demo-synth-voice-04-sync-sweep.js](../../src/js/config/patches/demo-synth-voice-04-sync-sweep.js) |
| Demo - Synth Voice 05 - Oscillator Stack | [demo-synth-voice-05-oscillator-stack.js](../../src/js/config/patches/demo-synth-voice-05-oscillator-stack.js) |
| Demo - Synth Voice 06 - Post-filter Noise | [demo-synth-voice-06-post-filter-noise.js](../../src/js/config/patches/demo-synth-voice-06-post-filter-noise.js) |
| Demo - Synth Voice 07 - Mixed CV | [demo-synth-voice-07-mixed-cv.js](../../src/js/config/patches/demo-synth-voice-07-mixed-cv.js) |
| Demo - Synth Voice 08 - Filter Modes | [demo-synth-voice-08-filter-modes.js](../../src/js/config/patches/demo-synth-voice-08-filter-modes.js) |
| Demo - Synth Voice 09 - Envelopes and Accents | [demo-synth-voice-09-envelopes-and-accents.js](../../src/js/config/patches/demo-synth-voice-09-envelopes-and-accents.js) |
| Demo - Synth Voice 10 - Animated Envelope | [demo-synth-voice-10-animated-envelope.js](../../src/js/config/patches/demo-synth-voice-10-animated-envelope.js) |
| Demo - Synth Voice 11 - VCA Modulation | [demo-synth-voice-11-vca-modulation.js](../../src/js/config/patches/demo-synth-voice-11-vca-modulation.js) |
| Demo - Synth Voice 12 - Dynamic Generative | [demo-synth-voice-12-dynamic-generative.js](../../src/js/config/patches/demo-synth-voice-12-dynamic-generative.js) |
| Demo - Sci-Fi Shooter | [scifi-shooter.js](../../src/js/config/patches/scifi-shooter.js) |
| SFX - Laser | [sfx-laser.js](../../src/js/config/patches/sfx-laser.js) |
| SFX - Explosion | [sfx-explosion.js](../../src/js/config/patches/sfx-explosion.js) |
| SFX - Shield Impact | [sfx-shield.js](../../src/js/config/patches/sfx-shield.js) |
| SFX - Powerup | [sfx-powerup.js](../../src/js/config/patches/sfx-powerup.js) |
| Demo - Whale Song | [whale-song.js](../../src/js/config/patches/whale-song.js) |
| Demo - Deep Abyss | [deep-abyss.js](../../src/js/config/patches/deep-abyss.js) |
| Drums - Basic Beat | [drums-basic-beat.js](../../src/js/config/patches/drums-basic-beat.js) |
| Drums - 808 Style | [drums-808-style.js](../../src/js/config/patches/drums-808-style.js) |
| Drums - Punchy Kick | [drums-punchy-kick.js](../../src/js/config/patches/drums-punchy-kick.js) |
| Drums - Snare Roll | [drums-snare-roll.js](../../src/js/config/patches/drums-snare-roll.js) |
| Drums - Hat Patterns | [drums-hat-patterns.js](../../src/js/config/patches/drums-hat-patterns.js) |
| Drums - Full Kit | [drums-full-kit.js](../../src/js/config/patches/drums-full-kit.js) |

## Updating the archive

When a module contract changes, update the affected source patch and this JSON collection together. The catalogue tests verify that every archived source is present and that the downloadable collection imports without changing its version 3 state.

Run `npm test -- tests/config/patch-catalogs.test.js tests/config/factory-patches.test.js tests/app/patch-format.test.js` after changes.
