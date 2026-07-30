# Noise Generator (nse)

## Hardware Reference
- **Based on**: [2hp Nse](http://www.twohp.com/modules/p/nse)
- **Manual**: [Nse Manual PDF](https://www.twohp.com/modules/p/nse) (download from product page)
- **ModularGrid**: [2hp Nse](https://www.modulargrid.net/e/2hp-nse)

## Specifications

### Features
- White noise generator
- Adjustable sample rate (downsample for lo-fi noise)
- VCA mode for enveloped noise bursts
- Depth: 45mm

### Power (Hardware)
- +12V: 35mA
- -12V: 16mA

### Controls
- **Rate**: Sample rate / decay time (context-dependent)
  - Normal mode: Downsample factor (high = white noise, low = rumble)
  - VCA mode: Envelope decay time

### Inputs
- **Trigger**: Gate input for VCA mode bursts

### Outputs
- **Noise**: ±5V noise output

### Indicators
- **Active LED**: Shows envelope level in VCA mode

### Modes
- **Normal**: Continuous noise with adjustable sample rate
- **VCA**: Triggered noise bursts with attack/decay envelope

## DSP Implementation

### White Noise Generation
```javascript
sample = (Math.random() * 2 - 1) * 5  // ±5V
```

### Downsampling (Normal Mode)
Hold each random sample for N samples:
```javascript
sampleCounter++
if (sampleCounter >= downsampleFactor) {
    heldSample = generateNoise()
    sampleCounter = 0
}
output = heldSample
```

Downsample mapping (quadratic for musical response):
```javascript
maxHoldSamples = sampleRate * (501 / 44100)
downsampleFactor = 1 + (1 - rate)² × (maxHoldSamples - 1)
```

### VCA Mode Envelope
Attack-decay envelope triggered by gate:
```javascript
// Attack: 1ms linear ramp
// Decay: 10-500ms linear ramp (controlled by Rate knob)
if (triggerEdge) {
    startEnvelope()
}
output = noise × envelopeLevel
```

### Key Concepts
- **Sample & hold noise**: Classic lo-fi technique
- **Aliasing**: Intentional for gritty textures at low sample rates
- **Percussion synthesis**: VCA mode ideal for hi-hats, snares

## Noise Types (Theory)

### White Noise
- Equal power across all frequencies
- "Hissy" character
- Flat spectrum

### Pink Noise (not implemented)
- 3dB/octave rolloff
- Equal power per octave
- More natural/organic sound

### Brown/Red Noise (not implemented)
- 6dB/octave rolloff
- Rumble/thunder character

## DSP References
- [White Noise Generation - MusicDSP](https://www.musicdsp.org/en/latest/Synthesis/216-fast-whitenoise-generator.html)
- [Noise Colors - Wikipedia](https://en.wikipedia.org/wiki/Colors_of_noise)
- [Sample Rate Reduction - MusicDSP](https://www.musicdsp.org/en/latest/Effects/102-simple-sample-rate-reduction.html)

## Potential Improvements
- Add pink/brown noise options
- Implement proper filtered noise (not just downsampling)
- Add noise density control

## Sources
- [2hp Nse Product Page](http://www.twohp.com/modules/p/nse)
- [ModularGrid - 2hp Nse](https://www.modulargrid.net/e/2hp-nse)

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/nse.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- DSP and panel Rate defaults now agree at 1, giving full-rate white noise by
  default. Trigger declares 0-10V with 0V normal and the exact >=1V threshold;
  Noise declares +/-5V.
- Normal-mode downsampling now scales its hold count with sample rate. At minimum
  Rate the number of random changes per physical second agrees within one
  quantized event at 44.1 and 96kHz; the old fixed 501-sample hold ran over
  twice as fast at 96kHz.
- VCA retrigger captures the current envelope as its attack start rather than
  dropping gain to zero for one attack, eliminating the retrigger notch under a
  deterministic constant noise source.
- Switching VCA mode off clears the old burst envelope so re-enabling it cannot
  resume stale attack/decay state without a new trigger.
- Noise generation is injectable and invalid RNG/param/trigger values recover
  safely. The 1ms attack and 10-500ms Rate-frozen decay use rounded physical
  sample counts; minimum decay agrees across sample rates within one sample.
- Reset clears trigger/noise buffers, envelope/mode/edge state, held noise, and
  LED in place.
- Focused and module-contract validation passes 38 assertions across white-noise
  range/mean/variation, downsampling, both modes, exact threshold, retrigger and
  mode transitions, decay endpoints, LEDs, finite recovery, rails, and reset.
- The strict 44.1/48/96kHz by 128/512 matrix completes five scenarios with
  finite output, zero voltage flags, stable buffers, peaks within 0.002V of the
  +/-5V rails, and a maximum Node diagnostic time below 0.124ms per block.
