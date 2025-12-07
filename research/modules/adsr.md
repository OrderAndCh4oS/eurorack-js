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
