# Introduction demo

Original composition, 15 November 2026. A seven-note plucked melody runs over four slower bass roots, a steady kick and closed hats. Small changes in pluck tone and decay keep the repeated notes moving. Chorus and reverb widen the melody; the bass and kick stay dry and central.

## Research and choice

Three approaches were considered:

1. **Unequal melodic loops with controlled modulation.** Bastl's Neo Trinity combines independently sized automation loops, clocked triggers and CV modulation. Different loop lengths provide variation while retaining a repeatable musical idea. This is the strongest starting point for the introduction: the tune is apparent immediately and its relationship to the bass continues changing.
2. **A single voice with changing pitch, strength and timing.** Make Noise's 0-CTRL treats those as separate patchable dimensions. This is useful for showing how the rack works, but a single voice alone would show less of the instrument. The bass applies the same separation of pitch, note shape and timbre using SEQ, FUNC, VCF and VCA.
3. **A clock-derived rhythm patch.** ALM's Pamela's PRO Workout manual describes related clock outputs and independently patterned events. Drums alone would be a narrower introduction. A restrained beat beneath the melody makes the shared clock audible without making every sound follow the same phrase length.

The selected patch combines the first approach with a conventional bass voice and a simple rhythmic foundation. It is an original composition, not a reconstruction of a manufacturer's demonstration or a hardware emulation of those sequencers.

### Primary sources

- [Bastl Instruments — Neo Trinity](https://bastl-instruments.com/eurorack/modules/neo-trinity), current manufacturer description and feature contract, accessed 2026-11-15. Supports independent automation lengths, clock synchronization, trigger patterns and controllable modulation depth. The page links Bastl's own clock-channel and CV-mode tutorials; the design here is based on the written feature documentation, not a claim to have listened to those videos.
- [Make Noise — 0-CTRL](https://www.makenoisemusic.com/synthesizers-and-controllers/0-ctrl/), manufacturer product documentation, accessed 2026-11-15. Supports separate sequencing of pitch, note strength and time, with clock and gate outputs for linked events.
- [ALM Busy Circuits — Pamela's PRO Workout manual](https://assets.busycircuits.com/docs/alm034-manual.pdf), manufacturer manual, accessed 2026-11-15. Its output, phase, probability and Euclidean-pattern sections describe ways to derive related rhythmic activity from a common clock. This patch uses simple division rather than claiming to implement Pamela's full rhythm generator.

## Musical design

- **Tempo:** CLK rate 0.301 produces about 3.1989 pulses/second: eighth notes at approximately 95.97 BPM. First melody and hat onset is about 0.313 seconds after Start; the beat and bass enter at about 0.625 seconds.
- **Melody:** A4, C5, E5, G5, E5, D5, C5. Seven eighth notes repeat against a four-bar bass cycle. SEQ's stored steps are rotated because its first clock advances to step 2.
- **Bass roots:** A2, F2, C3, G2, one root per four-beat bar. A2 is present before the first divided clock changes it to F2. The full alignment of the seven-note melody and 32-eighth-note bass pattern repeats after 224 eighth notes, about 70 seconds.
- **Bass articulation:** one short rise/fall envelope per beat, about 3 ms rise and 446 ms nominal fall. A FUNC envelope completes after DIV's 1 ms trigger ends, avoiding an ADSR whose attack would be interrupted by that short gate.
- **Timbre:** a roughly 13.5-second LFO changes the pluck's damping, pick position and decay by about ±0.08 of their control ranges. Pitch and clock timing remain fixed.
- **Space and mix:** the pluck goes through a shallow stereo chorus and reverb. Dry bass, kick and hats join the stereo returns in two MIX modules. Hats are slightly louder on the right. No samples, MIDI source or account are needed.
- **Rack:** 18 modules and 31 cables, in rows of 39 HP and 41 HP. Every module has a useful route to OUT. The patch is separate from the Test patches catalogue.

## Source contracts and tuning

Exact ports and parameter names were checked in `src/js/modules/{clk,div,seq,pluck,vco,vcf,func,vca,atten,lfo,kick,hat,chorus,verb,mix,out}/index.js`.

- CLK: `clock` output, `rate` mapping `0.1 × 100000^rate` Hz.
- DIV: `clock` input, `out1` and `out2` outputs. `rate1: 0.438` selects /2; `rate2: 0.063` selects /8 through the module's 17-position ratio map.
- SEQ: `clock` input, `cv` and `gate` outputs; `range: 0` gives 0–1 V. Note values are rounded to three decimals for snapshot URL compatibility, introducing less than half a cent of tuning error.
- PLUCK: `pitch: 0.6` gives an A4 base because the formula is `55 × 2^(5 × pitch + vOct)`. Its `dampCV` and `positionCV` sample modulation on each trigger. Four internal voices allow notes to overlap.
- VCO: `coarse: 0.353`, `fine: -0.067` tune its base to approximately F2 using `4.3 × (22000/4.3)^coarse × 2^(fine/12)`. Root CV adds the required semitones.
- FUNC `out` spans 0–10 V. ATTEN channel 1 at `atten1: 0.75`, `offset1: 0.5` halves it for VCA `ch1CV` and VCF `cutoffCV`, both expecting 0–5 V.
- LFO `primary` is 0–5 V. ATTEN channel 2 at `atten2: 0.58`, `offset2: 0.46` scales and offsets it to approximately −0.4…+0.4 V.
- Separate MIX modules receive the reverb's `outL` and `outR`, then feed OUT `L` and `R`. There are no duplicate input destinations.

## Validation

The composition source is `src/js/config/patches/demo-introduction.js`. Patch normalization and graph compilation pass. Static connection diagnostics report no issues across 18 modules and 31 cables; the graph has no feedback routes.

A 45-second offline render uses the production graph at 44.1 kHz with 128-sample blocks. All samples are finite, with no final-output clipping. Final left/right peaks are −9.41/−9.33 dBFS; RMS levels are −27.85/−27.87 dBFS; mean output is 0.000215/0.000145 on the normalized ±1 output scale. Measured sequence pitches match the intended notes within 0.41 cents. The initial render showed the bass and kick dominating the melody; reducing their mixer levels and extending the pluck decay brought the melody's peak above the bass while retaining headroom. This is a soft, transient-led mix rather than loud mastering.

The VCA's initial CV slew produces a brief bass transient at startup, measured around −35 dBFS over the first 20 ms. The intended clocked entries follow at the times above. This did not justify changing shared module DSP for the composition.

These are signal measurements and source checks, not a claim of subjective listening. Browser loading, audio playback and the generated rack images are checked during page integration.

## Short description

A seven-note plucked melody, pulsing bass and light drums, with slowly changing tone and stereo reverb.
