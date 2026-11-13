/**
 * Complete built-in patch catalogue for regression checks and archive export.
 * The application imports TEST_PATCHES directly from ../test-patches.js.
 */
import { TEST_PATCHES } from '../test-patches.js';

// Demo patches
import demoMelodicArp from './demo-melodic-arp.js';
import demoPulsingBass from './demo-pulsing-bass.js';
import demoShRandom from './demo-sh-random.js';
import demoFilterEnvelope from './demo-filter-envelope.js';
import demoEvolvingDrone from './demo-evolving-drone.js';
import demoDrumAndBass from './demo-drum-and-bass.js';
import demoDubDelay from './demo-dub-delay.js';
import demoAmbientPad from './demo-ambient-pad.js';
import demoTripHop from './demo-trip-hop.js';
import demoTechno from './demo-techno.js';
import demoNeonGrid from './demo-neon-grid.js';
import demoRoundRobinVoices from './demo-round-robin-voices.js';
import demoSynthVoice01 from './demo-synth-voice-01-subtractive.js';
import demoSynthVoice02 from './demo-synth-voice-02-waveform-blend.js';
import demoSynthVoice03 from './demo-synth-voice-03-tracked-fm.js';
import demoSynthVoice04 from './demo-synth-voice-04-sync-sweep.js';
import demoSynthVoice05 from './demo-synth-voice-05-oscillator-stack.js';
import demoSynthVoice06 from './demo-synth-voice-06-post-filter-noise.js';
import demoSynthVoice07 from './demo-synth-voice-07-mixed-cv.js';
import demoSynthVoice08 from './demo-synth-voice-08-filter-modes.js';
import demoSynthVoice09 from './demo-synth-voice-09-envelopes-and-accents.js';
import demoSynthVoice10 from './demo-synth-voice-10-animated-envelope.js';
import demoSynthVoice11 from './demo-synth-voice-11-vca-modulation.js';
import demoSynthVoice12 from './demo-synth-voice-12-dynamic-generative.js';
import scifiShooter from './scifi-shooter.js';
import sfxLaser from './sfx-laser.js';
import sfxExplosion from './sfx-explosion.js';
import sfxShield from './sfx-shield.js';
import sfxPowerup from './sfx-powerup.js';
import whaleSong from './whale-song.js';
import deepAbyss from './deep-abyss.js';

// Drum patches
import drumsBasicBeat from './drums-basic-beat.js';
import drums808Style from './drums-808-style.js';
import drumsPunchyKick from './drums-punchy-kick.js';
import drumsSnareRoll from './drums-snare-roll.js';
import drumsHatPatterns from './drums-hat-patterns.js';
import drumsFullKit from './drums-full-kit.js';

/** Musical examples retained for later import, outside the main library. */
export const ARCHIVED_DEMO_PATCHES = {
    // Demo patches
    [demoMelodicArp.name]: demoMelodicArp,
    [demoPulsingBass.name]: demoPulsingBass,
    [demoShRandom.name]: demoShRandom,
    [demoFilterEnvelope.name]: demoFilterEnvelope,
    [demoEvolvingDrone.name]: demoEvolvingDrone,
    [demoDrumAndBass.name]: demoDrumAndBass,
    [demoDubDelay.name]: demoDubDelay,
    [demoAmbientPad.name]: demoAmbientPad,
    [demoTripHop.name]: demoTripHop,
    [demoTechno.name]: demoTechno,
    [demoNeonGrid.name]: demoNeonGrid,
    [demoRoundRobinVoices.name]: demoRoundRobinVoices,
    [demoSynthVoice01.name]: demoSynthVoice01,
    [demoSynthVoice02.name]: demoSynthVoice02,
    [demoSynthVoice03.name]: demoSynthVoice03,
    [demoSynthVoice04.name]: demoSynthVoice04,
    [demoSynthVoice05.name]: demoSynthVoice05,
    [demoSynthVoice06.name]: demoSynthVoice06,
    [demoSynthVoice07.name]: demoSynthVoice07,
    [demoSynthVoice08.name]: demoSynthVoice08,
    [demoSynthVoice09.name]: demoSynthVoice09,
    [demoSynthVoice10.name]: demoSynthVoice10,
    [demoSynthVoice11.name]: demoSynthVoice11,
    [demoSynthVoice12.name]: demoSynthVoice12,
    [scifiShooter.name]: scifiShooter,
    [sfxLaser.name]: sfxLaser,
    [sfxExplosion.name]: sfxExplosion,
    [sfxShield.name]: sfxShield,
    [sfxPowerup.name]: sfxPowerup,
    [whaleSong.name]: whaleSong,
    [deepAbyss.name]: deepAbyss,

    // Drum patches
    [drumsBasicBeat.name]: drumsBasicBeat,
    [drums808Style.name]: drums808Style,
    [drumsPunchyKick.name]: drumsPunchyKick,
    [drumsSnareRoll.name]: drumsSnareRoll,
    [drumsHatPatterns.name]: drumsHatPatterns,
    [drumsFullKit.name]: drumsFullKit
};

/** All built-in source patches, including the archived examples. */
export const FACTORY_PATCHES = { ...TEST_PATCHES, ...ARCHIVED_DEMO_PATCHES };
