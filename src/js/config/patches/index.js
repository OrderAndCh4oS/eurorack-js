/**
 * Factory Patches Index
 *
 * Aggregates all factory patches from individual files.
 * Each patch file exports a default object with:
 *   - name: Display name
 *   - factory: true (marks as read-only factory patch)
 *   - state: Patch state object with modules, knobs, switches, buttons, cables
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
import testEuclid from './test-euclid.js';
import testLogic from './test-logic.js';
import testMult from './test-mult.js';
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
import testReverb from './test-reverb.js';
import testChorus from './test-chorus.js';
import testPhaser from './test-phaser.js';
import testFlanger from './test-flanger.js';
import testCrush from './test-crush.js';
import testDb from './test-db.js';
import testPwm from './test-pwm.js';
import testTuring from './test-turing.js';
import testOchd from './test-ochd.js';
import testCmp2 from './test-cmp2.js';
import testAttenuverter from './test-attenuverter.js';
import testSlew from './test-slew.js';

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
    [testEuclid.name]: testEuclid,
    [testLogic.name]: testLogic,
    [testMult.name]: testMult,
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
    [testReverb.name]: testReverb,
    [testChorus.name]: testChorus,
    [testPhaser.name]: testPhaser,
    [testFlanger.name]: testFlanger,
    [testCrush.name]: testCrush,
    [testDb.name]: testDb,
    [testPwm.name]: testPwm,
    [testTuring.name]: testTuring,
    [testOchd.name]: testOchd,
    [testCmp2.name]: testCmp2,
    [testAttenuverter.name]: testAttenuverter,
    [testSlew.name]: testSlew,

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

    // Drum patches
    [drumsBasicBeat.name]: drumsBasicBeat,
    [drums808Style.name]: drums808Style,
    [drumsPunchyKick.name]: drumsPunchyKick,
    [drumsSnareRoll.name]: drumsSnareRoll,
    [drumsHatPatterns.name]: drumsHatPatterns,
    [drumsFullKit.name]: drumsFullKit
};
