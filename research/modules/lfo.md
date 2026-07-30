# Low Frequency Oscillator (lfo)

## Hardware Reference
- **Based on**: [2hp LFO](http://www.twohp.com/modules/p/lfo)
- **Manual**: [LFO Manual PDF](https://www.twohp.com/modules/p/lfo) (download from product page)
- **ModularGrid**: [2hp LFO](https://www.modulargrid.net/e/2hp-lfo)

## Specifications

### Features
- 8 waveforms with smooth morphing between each
- Two simultaneous outputs (primary + secondary)
- Wide frequency range: 30 second cycle to audio rate
- Reset input for sync
- Skiff friendly (45mm depth)

### Power (Hardware)
- +12V: 40mA
- -12V: 6mA
- Depth: 45mm

### Controls
- **Rate**: Frequency control (exponential)
- **Wave**: Morph between waveforms
- **Range**: Switch for slow/fast mode

### Inputs
- **Rate CV**: Frequency modulation (0-5V = 0-5 octaves)
- **Wave CV**: Waveform modulation
- **Reset**: Trigger to reset phase (≥1V rising edge)

### Outputs
- **Primary**: Main waveform bank (sine → triangle → saw → square)
- **Secondary**: Alternate waveform bank (complex/modulated shapes)

### Frequency Ranges
- **Slow mode**: 1/27 Hz to 20 Hz (27 seconds to 50ms period)
- **Fast mode**: 1/3.3 Hz to 152 Hz (3.3 seconds to 6.6ms period)

## DSP Implementation

### Algorithm Overview
Phase accumulator with waveform crossfading:
```javascript
phase = (phase + freq / sampleRate) % 1
output = crossfade(waveA(phase), waveB(phase), morphAmount)
```

### Waveform Banks

#### Primary Bank
1. **Sine**: `sin(2π × phase)`
2. **Triangle**: `2 × |2 × (phase - 0.5)| - 1`
3. **Sawtooth**: `2 × phase - 1`
4. **Square**: `phase < 0.5 ? 1 : -1`

#### Secondary Bank
1. **Sine difference**: `|sin| - |cos|`
2. **Ring mod**: `sin(t) × sin(4t)`
3. **Ramp down**: `1 - 2 × phase`
4. **Stepped triangle**: Quantized triangle

### Crossfade Algorithm
```javascript
const pos = waveKnob * 3  // 0-3 across 4 waveforms
const idx = Math.floor(pos)
const frac = pos - Math.floor(pos)
const next = Math.min(idx + 1, 3)
output = (1 - frac) * wave[idx](t) + frac * wave[next](t)
```

### Output Scaling
- Internal: -1 to +1 (bipolar)
- Output: 0 to 5V (unipolar)
- Conversion: `output = (internal + 1) × 2.5`

### Key Concepts
- **Waveform morphing**: Smooth interpolation between shapes
- **Dual outputs**: Two banks provide different modulation characters
- **Reset sync**: Phase reset on trigger for tempo sync

## DSP References
- [Waveform Generation - CCRMA](https://ccrma.stanford.edu/~jos/pasp/Digital_Waveguide_Oscillator.html)
- [LFO Design - Sound on Sound](https://www.soundonsound.com/techniques/introduction-lfos)
- [MusicDSP - Waveforms](https://www.musicdsp.org/en/latest/Synthesis/index.html)

## Sources
- [2hp LFO Product Page](http://www.twohp.com/modules/p/lfo)
- [ModularGrid - 2hp LFO](https://www.modulargrid.net/e/2hp-lfo)

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/lfo.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- Rate CV, Wave CV, and Reset are now sampled per audio sample instead of only
  at index zero of each render block. Mid-block fixtures prove that modulation
  and reset take effect at the exact incoming sample.
- Reset now renders phase zero on its rising-edge sample before phase advances,
  producing the documented 2.5V sine center at that sample.
- The Wave mapping now spans positions 0-3 and clamps its final neighbor.
  Previously maximum Wave wrapped from the fourth shape back to sine, making the
  documented square/stepped-triangle endpoints unreachable at knob/CV maximum.
- DSP and UI Rate defaults now agree at 0.3. Non-finite params/CV recover safely;
  Rate/Wave CV declare 0-5V normals, Reset 0-10V, and both outputs exact 0-5V.
- Reset clears phase, edge state, and every stable input/output buffer in place.
- Focused and module-contract validation passes 46 assertions, including both
  frequency ranges, all continuous/switch/CV controls, endpoint shapes,
  sample-exact Reset, rails, finite recovery, and stable reset.
- The strict 44.1/48/96kHz by 128/512 matrix completes seven scenarios with
  finite output, zero voltage flags, stable buffers, exact 5.000V peaks, and a
  maximum Node diagnostic time below 0.175ms per block.
