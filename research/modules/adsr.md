# ADSR Envelope Generator (adsr)

## Hardware Reference
- **Based on**: CEM3310 / AS3310 envelope generator IC architecture
- **Datasheet**: [AS3310 Datasheet (PDF)](https://www.alfarzpp.lv/eng/sc/AS3310.pdf)
- **ModularGrid**: Various ADSR implementations

## Specifications

### Features
- Classic 4-stage envelope: Attack, Decay, Sustain, Release
- Exponential (RC) envelope curves
- Time range: 2ms to 10s per stage
- Retrigger input for re-attack during gate
- End-of-cycle trigger output
- Inverted output for ducking effects

### Controls
- **Attack**: Rise time (2ms - 10s, exponential mapping)
- **Decay**: Fall time to sustain (2ms - 10s)
- **Sustain**: Hold level (0-100% of peak)
- **Release**: Fall time to zero (2ms - 10s)

### Inputs
- **Gate**: Starts attack, holds sustain (≥1V threshold)
- **Retrigger**: Restarts attack while gate held (≥1V rising edge)

### Outputs
- **Env**: Main envelope output (0-5V)
- **Inv**: Inverted envelope (-5V to 0V)
- **EOC**: End-of-cycle trigger (5V pulse when release completes)

### Indicators
- **Env LED**: Shows current envelope level

## DSP Implementation

### Envelope Stages
```
IDLE → ATTACK → DECAY → SUSTAIN → RELEASE → IDLE
         ↑                            |
         +-------- (retrigger) -------+
```

### Exponential Curve Generation

#### One-Pole Filter Approach (Our Implementation)
Uses first-order IIR filter for natural RC curves:
```javascript
// Calculate coefficient for target time
function calcCoeff(timeSeconds, targetRatio = 0.001) {
    const samples = timeSeconds * sampleRate;
    return 1 - Math.exp(-Math.log((1 + targetRatio) / targetRatio) / samples);
}

// Attack: Approach 5.5V (overshoot for punchy attack)
// ln(11) places the 5V crossing at the selected Attack time.
attackCoeff = 1 - exp(-ln(11) / samples);
level += attackCoeff * (5.5 - level);

// Decay/Release: Approach target
level += decayCoeff * (target - level);
```

#### Why This Works
- True exponential `e^(-t/τ)` never reaches zero
- One-pole filter approaches target asymptotically
- Target ratio (0.001) defines "close enough" threshold
- Overshoot on attack (target 5.5 for 5V output) gives punchy response

### Time Mapping
Exponential knob response for musical time control:
```javascript
time = 0.002 * Math.pow(5000, knobValue)  // 2ms to 10s
```

### Stage Transitions
- **Attack → Decay**: When level reaches 5V
- **Decay → Sustain**: When level within 0.001 of sustain level
- **Sustain → Release**: On gate falling edge
- **Release → Idle**: When level drops below 0.001

## Hardware Reference: CEM3310/AS3310

### Chip Features
- Exponentially voltage-controllable A/D/R times
- Linear voltage-controllable sustain level
- Time control range: 50,000:1 to 100,000:1
- True RC envelope shape
- Peak attack voltage tracking

### Notable Implementations
- Digisound 80-10 ADSR
- Yusynth 7555 ADSR
- Prophet-5 and many classic synths

## DSP References
- [AS3310 Datasheet](https://www.alfarzpp.lv/eng/sc/AS3310.pdf) - Official specs
- [Exponential ADSR - DSP Stack Exchange](https://dsp.stackexchange.com/questions/2555/help-with-equations-for-exponential-adsr-envelope) - Mathematical approaches
- [Electric Druid AS3310](https://electricdruid.net/product/as3310-vcadsr/) - Usage notes
- [Eddy Bergman ADSR Tutorial](https://www.eddybergman.com/2019/11/synthesizer-build-part-3-envelope.html) - Build guide

## Potential Improvements
- Add CV inputs for each stage time
- Implement linear mode option
- Add loop mode (LFO-like behavior)
- Variable attack curve shape

## Sources
- [AS3310 Product Page](https://www.alfarzpp.lv/eng/sc/AS3310.pdf)
- [CEM3310 Information](https://electricdruid.net/product/as3310-vcadsr/)

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/adsr.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- Attack retains the 5.5V RC target/5V stage threshold, but its coefficient now
  uses `ln(11)` so the threshold is crossed at the selected time. Previously the
  generic 0.1% coefficient made the documented 2ms minimum reach 5V on the first
  1kHz sample instead of after two samples. Fixtures verify 2ms at 1k/2kHz.
- Gate is correctly typed as a gate rather than a trigger. Gate/ Retrig declare
  0-10V with 0V normals; all three time CVs declare +/-5V; Env is 0-5V, Inv is
  -5-0V, and EOC is 0-10V.
- EOC now emits a real exact 5ms/10V trigger. It was previously a single-sample
  5V marker, which did not satisfy the app trigger contract.
- Gate fall wins a coincident Retrig and enters Release; Retrig while Gate is
  held re-enters Attack from the current level without a voltage discontinuity.
  Mid-block fixtures lock both priorities and time-CV sample accuracy.
- Non-finite controls and input samples recover to defaults instead of poisoning
  edge memory, coefficients, or the persistent level. Reset clears all stages,
  edge/pulse state, LEDs, and stable buffers in place.
- Focused and module-contract validation passes 50 assertions across all four
  stages/knobs, every CV/input, timing range/RC shape, sustain linearity,
  gate/retrigger coincidence, exact EOC, rails, finite recovery, and reset.
- The strict 44.1/48/96kHz by 128/512 matrix completes nine scenarios with
  finite output, zero voltage flags, stable buffers, exact 10.000V peaks, and a
  maximum Node diagnostic time below 0.373ms per block.
