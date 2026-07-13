/**
 * Factory Patches Index
 *
 * Aggregates all factory patches from individual files.
 * Each patch file exports a default object with:
 *   - name: Display name
 *   - factory: true (marks as read-only factory patch)
 *   - state: Canonical v3 patch state
 */

// Test patches - Modules
import testVcoOnly from './test-vco-only.js';
import testLfoVcoPitch from './test-lfo-vco-pitch.js';
import testVcfResonance from './test-vcf-resonance.js';
import testAdsrEnvelope from './test-adsr-envelope.js';
import testNoiseOutput from './test-noise-output.js';
import testShPitch from './test-sh-pitch.js';
import testClockDivisions from './test-clock-divisions.js';
import testQuantizerScales from './test-quantizer-scales.js';
import testArpeggiator from './test-arpeggiator.js';
import testScopeSinewave from './test-scope-sinewave.js';
import testSequencer from './test-sequencer.js';
import testSeqSwitch from './test-seq-switch.js';
import testEuclid from './test-euclid.js';
import testSwing from './test-swing.js';
import testBurst from './test-burst.js';
import testGateDelay from './test-gate-delay.js';
import testQuadLfo from './test-quad-lfo.js';
import testLpg from './test-lpg.js';
import testLogic from './test-logic.js';
import testMult from './test-mult.js';
import testMatrix from './test-matrix.js';
import testJoystick from './test-joystick.js';
import testWavetable from './test-wavetable.js';
import testComplexVco from './test-complex-vco.js';
import testEnsembleVco from './test-ensemble-vco.js';
import testPluck from './test-pluck.js';
import testFormant from './test-formant.js';
import testResbank from './test-resbank.js';
import testFold from './test-fold.js';
import testRing from './test-ring.js';
import testRnd from './test-rnd.js';
import testEnvf from './test-envf.js';
import testEnvfSidechain from './test-envf-sidechain.js';
import testFunc from './test-func.js';
import testFuncEnvelope from './test-func-envelope.js';
import testFuncLfo from './test-func-lfo.js';
import testFuncSlew from './test-func-slew.js';
import testFuncEoc from './test-func-eoc.js';
import testDelay from './test-delay.js';
import testTape from './test-tape.js';
import testReverb from './test-reverb.js';
import testChorus from './test-chorus.js';
import testPhaser from './test-phaser.js';
import testFlanger from './test-flanger.js';
import testCrush from './test-crush.js';
import testLoop from './test-loop.js';
import testGranulita from './test-granulita.js';
import testDb from './test-db.js';
import testPwm from './test-pwm.js';
import testTuring from './test-turing.js';
import testOchd from './test-ochd.js';
import testCmp2 from './test-cmp2.js';
import testComp from './test-comp.js';
import testAttenuverter from './test-attenuverter.js';
import testSlew from './test-slew.js';
import testSpectrum from './test-spectrum.js';
import testPlot from './test-plot.js';
import testSpectrogram from './test-spectrogram.js';
import testCustomModules from './test-custom-modules.js';

// Test patches - MIDI
import testMidiCv from './test-midi-cv.js';
import testMidi4 from './test-midi-4.js';
import testMidiCc from './test-midi-cc.js';
import testMidiClk from './test-midi-clk.js';
import testMidiDrum from './test-midi-drum.js';

// Test patches - Drums
import testSnareOnly from './test-snare-only.js';
import testKickOnly from './test-kick-only.js';
import testHatOnly from './test-hat-only.js';

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

/**
 * All factory patches keyed by name
 */
export const FACTORY_PATCHES = {
    // Test patches - Modules
    [testVcoOnly.name]: testVcoOnly,
    [testLfoVcoPitch.name]: testLfoVcoPitch,
    [testVcfResonance.name]: testVcfResonance,
    [testAdsrEnvelope.name]: testAdsrEnvelope,
    [testNoiseOutput.name]: testNoiseOutput,
    [testShPitch.name]: testShPitch,
    [testClockDivisions.name]: testClockDivisions,
    [testQuantizerScales.name]: testQuantizerScales,
    [testArpeggiator.name]: testArpeggiator,
    [testScopeSinewave.name]: testScopeSinewave,
    [testSequencer.name]: testSequencer,
    [testSeqSwitch.name]: testSeqSwitch,
    [testEuclid.name]: testEuclid,
    [testSwing.name]: testSwing,
    [testBurst.name]: testBurst,
    [testGateDelay.name]: testGateDelay,
    [testQuadLfo.name]: testQuadLfo,
    [testLpg.name]: testLpg,
    [testLogic.name]: testLogic,
    [testMult.name]: testMult,
    [testMatrix.name]: testMatrix,
    [testJoystick.name]: testJoystick,
    [testWavetable.name]: testWavetable,
    [testComplexVco.name]: testComplexVco,
    [testEnsembleVco.name]: testEnsembleVco,
    [testPluck.name]: testPluck,
    [testFormant.name]: testFormant,
    [testResbank.name]: testResbank,
    [testFold.name]: testFold,
    [testRing.name]: testRing,
    [testRnd.name]: testRnd,
    [testEnvf.name]: testEnvf,
    [testEnvfSidechain.name]: testEnvfSidechain,
    [testFunc.name]: testFunc,
    [testFuncEnvelope.name]: testFuncEnvelope,
    [testFuncLfo.name]: testFuncLfo,
    [testFuncSlew.name]: testFuncSlew,
    [testFuncEoc.name]: testFuncEoc,
    [testDelay.name]: testDelay,
    [testTape.name]: testTape,
    [testReverb.name]: testReverb,
    [testChorus.name]: testChorus,
    [testPhaser.name]: testPhaser,
    [testFlanger.name]: testFlanger,
    [testCrush.name]: testCrush,
    [testLoop.name]: testLoop,
    [testGranulita.name]: testGranulita,
    [testDb.name]: testDb,
    [testPwm.name]: testPwm,
    [testTuring.name]: testTuring,
    [testOchd.name]: testOchd,
    [testCmp2.name]: testCmp2,
    [testComp.name]: testComp,
    [testAttenuverter.name]: testAttenuverter,
    [testSlew.name]: testSlew,
    [testSpectrum.name]: testSpectrum,
    [testPlot.name]: testPlot,
    [testSpectrogram.name]: testSpectrogram,
    [testCustomModules.name]: testCustomModules,

    // Test patches - MIDI
    [testMidiCv.name]: testMidiCv,
    [testMidi4.name]: testMidi4,
    [testMidiCc.name]: testMidiCc,
    [testMidiClk.name]: testMidiClk,
    [testMidiDrum.name]: testMidiDrum,

    // Test patches - Drums
    [testSnareOnly.name]: testSnareOnly,
    [testKickOnly.name]: testKickOnly,
    [testHatOnly.name]: testHatOnly,

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
