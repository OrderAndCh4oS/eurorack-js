/**
 * Built-in test patches for the dedicated Test patches view.
 *
 * Keep this import graph independent of the archived musical examples. The
 * complete FACTORY_PATCHES catalogue is reserved for regression/archive tools.
 */

// Test patches - Modules
import testVcoOnly from './patches/test-vco-only.js';
import testLfoVcoPitch from './patches/test-lfo-vco-pitch.js';
import testVcfResonance from './patches/test-vcf-resonance.js';
import testAdsrEnvelope from './patches/test-adsr-envelope.js';
import testNoiseOutput from './patches/test-noise-output.js';
import testShPitch from './patches/test-sh-pitch.js';
import testClockDivisions from './patches/test-clock-divisions.js';
import testQuantizerScales from './patches/test-quantizer-scales.js';
import testArpeggiator from './patches/test-arpeggiator.js';
import testScopeSinewave from './patches/test-scope-sinewave.js';
import testSequencer from './patches/test-sequencer.js';
import testProbSeq from './patches/test-prob-seq.js';
import testSeqSwitch from './patches/test-seq-switch.js';
import testEuclid from './patches/test-euclid.js';
import testChangesCascade from './patches/test-changes-cascade.js';
import testRefrain from './patches/test-refrain.js';
import testSwing from './patches/test-swing.js';
import testBurst from './patches/test-burst.js';
import testGateDelay from './patches/test-gate-delay.js';
import testQuadLfo from './patches/test-quad-lfo.js';
import testLpg from './patches/test-lpg.js';
import testLogic from './patches/test-logic.js';
import testMult from './patches/test-mult.js';
import testMatrix from './patches/test-matrix.js';
import testJoystick from './patches/test-joystick.js';
import testCvRec from './patches/test-cv-rec.js';
import testPitchTracker from './patches/test-pitch-tracker.js';
import testWavetable from './patches/test-wavetable.js';
import testComplexVco from './patches/test-complex-vco.js';
import testEnsembleVco from './patches/test-ensemble-vco.js';
import testPluck from './patches/test-pluck.js';
import testFormant from './patches/test-formant.js';
import testResbank from './patches/test-resbank.js';
import testFold from './patches/test-fold.js';
import testRing from './patches/test-ring.js';
import testVocoder from './patches/test-vocoder.js';
import testRnd from './patches/test-rnd.js';
import testEnvf from './patches/test-envf.js';
import testEnvfSidechain from './patches/test-envf-sidechain.js';
import testFunc from './patches/test-func.js';
import testFuncEnvelope from './patches/test-func-envelope.js';
import testFuncLfo from './patches/test-func-lfo.js';
import testFuncSlew from './patches/test-func-slew.js';
import testFuncEoc from './patches/test-func-eoc.js';
import testDelay from './patches/test-delay.js';
import testTape from './patches/test-tape.js';
import testReverb from './patches/test-reverb.js';
import testChorus from './patches/test-chorus.js';
import testPhaser from './patches/test-phaser.js';
import testFlanger from './patches/test-flanger.js';
import testCrush from './patches/test-crush.js';
import testLoop from './patches/test-loop.js';
import testGranulita from './patches/test-granulita.js';
import testShimmer from './patches/test-shimmer.js';
import testDb from './patches/test-db.js';
import testPwm from './patches/test-pwm.js';
import testTuring from './patches/test-turing.js';
import testOchd from './patches/test-ochd.js';
import testChaos from './patches/test-chaos.js';
import testCmp2 from './patches/test-cmp2.js';
import testComp from './patches/test-comp.js';
import testAttenuverter from './patches/test-attenuverter.js';
import testSlew from './patches/test-slew.js';
import testSpectrum from './patches/test-spectrum.js';
import testPlot from './patches/test-plot.js';
import testSpectrogram from './patches/test-spectrogram.js';
import testCustomModules from './patches/test-custom-modules.js';

// Test patches - MIDI
import testMidiCv from './patches/test-midi-cv.js';
import testMidi4 from './patches/test-midi-4.js';
import testMidiCc from './patches/test-midi-cc.js';
import testMidiClk from './patches/test-midi-clk.js';
import testMidiDrum from './patches/test-midi-drum.js';

// Test patches - Drums
import testSnareOnly from './patches/test-snare-only.js';
import testKickOnly from './patches/test-kick-only.js';
import testHatOnly from './patches/test-hat-only.js';

export const TEST_PATCHES = {
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
    [testProbSeq.name]: testProbSeq,
    [testSeqSwitch.name]: testSeqSwitch,
    [testEuclid.name]: testEuclid,
    [testChangesCascade.name]: testChangesCascade,
    [testRefrain.name]: testRefrain,
    [testSwing.name]: testSwing,
    [testBurst.name]: testBurst,
    [testGateDelay.name]: testGateDelay,
    [testQuadLfo.name]: testQuadLfo,
    [testLpg.name]: testLpg,
    [testLogic.name]: testLogic,
    [testMult.name]: testMult,
    [testMatrix.name]: testMatrix,
    [testJoystick.name]: testJoystick,
    [testCvRec.name]: testCvRec,
    [testPitchTracker.name]: testPitchTracker,
    [testWavetable.name]: testWavetable,
    [testComplexVco.name]: testComplexVco,
    [testEnsembleVco.name]: testEnsembleVco,
    [testPluck.name]: testPluck,
    [testFormant.name]: testFormant,
    [testResbank.name]: testResbank,
    [testFold.name]: testFold,
    [testRing.name]: testRing,
    [testVocoder.name]: testVocoder,
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
    [testShimmer.name]: testShimmer,
    [testDb.name]: testDb,
    [testPwm.name]: testPwm,
    [testTuring.name]: testTuring,
    [testOchd.name]: testOchd,
    [testChaos.name]: testChaos,
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
    [testHatOnly.name]: testHatOnly
};
