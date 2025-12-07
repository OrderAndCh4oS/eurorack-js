# Sound Engineering Review

A systematic analysis of each module comparing current implementation against research-backed best practices. Each recommendation includes the rationale, expected improvement, implementation options, and priority level.

## Review Methodology

For each module we evaluate:
1. **Algorithm Quality** - Is the DSP approach optimal for sound quality?
2. **Analog Modeling Accuracy** - Does it capture the character of hardware?
3. **Parameter Ranges** - Are they musical and useful?
4. **Numerical Stability** - Are there denormal, overflow, or precision issues?
5. **Modulation Response** - Do CV inputs behave musically?

Priority levels: **Critical** (audible artifacts), **High** (noticeable improvement), **Medium** (subtle refinement), **Low** (nice-to-have)

---

## VCO (Voltage Controlled Oscillator)

### Current Implementation
- PolyBLEP anti-aliasing for saw and pulse
- Slew-limited pitch CV for glide
- FM input with linear frequency offset
- Hard sync on rising edge

### Findings

| Issue | Current | Recommendation | Priority |
|-------|---------|----------------|----------|
| Triangle aliasing | No anti-aliasing applied | Apply PolyBLAMP for triangle wave | Medium |
| FM implementation | Linear FM only | Add through-zero FM option | High |
| Sync discontinuity | Abrupt phase reset | Apply PolyBLEP residual at sync point | Medium |
| DC offset | No DC blocking | Add optional DC blocker for external mixing | Low |

### Detailed Recommendations

#### 1. Triangle Anti-Aliasing (PolyBLAMP)
**Current**: Triangle is calculated as `4 * Math.abs(t - 0.5) - 1` without anti-aliasing.
**Issue**: While triangle has no discontinuities (continuous derivative), the *corner* at the peak/trough creates weak aliasing at high frequencies.
**Solution**: Apply PolyBLAMP (integrated PolyBLEP) at the corner points.
**Expected Improvement**: Cleaner high-frequency triangles, less intermodulation with other oscillators.

```javascript
function polyBlamp(t, dt) {
    if (t < dt) {
        const x = t / dt;
        const x2 = x * x;
        return (x2 * x / 3 - x2 / 2) * dt;
    } else if (t > 1 - dt) {
        const x = (t - 1) / dt;
        const x2 = x * x;
        return -(x2 * x / 3 + x2 / 2) * dt;
    }
    return 0;
}
// Apply at t=0.5 (peak) by adjusting triangle calculation
```

#### 2. Through-Zero FM
**Current**: FM adds linearly to frequency: `freq + fmVal * fmVoltsPerHz`
**Issue**: Linear FM can't go below 0Hz, causing asymmetric sidebands.
**Solution**: Implement phase modulation (mathematically equivalent to true FM).
**Expected Improvement**: Cleaner, more musical FM timbres.

```javascript
// Phase modulation approach (true FM equivalent)
const fmAmount = fmVal * fmIndex;
phase = (phase + inc + fmAmount / sampleRate) % 1;
```

#### 3. Hard Sync PolyBLEP
**Current**: Phase resets to 0 on sync edge.
**Issue**: Creates discontinuity not smoothed by PolyBLEP.
**Solution**: Apply PolyBLEP correction at sync point based on where in the cycle we were.
**Expected Improvement**: Smoother sync sweeps at high frequencies.

---

## VCF (Voltage Controlled Filter)

### Current Implementation
- Zero-delay feedback (ZDF) ladder topology
- 4 cascaded one-pole filters
- Tanh soft clipping in feedback path
- Simultaneous LP/BP/HP outputs

### Findings

| Issue | Current | Recommendation | Priority |
|-------|---------|----------------|----------|
| Resonance compensation | None | Add gain compensation at high resonance | High |
| Cutoff CV | Per-buffer modulation | Per-sample CV tracking | Medium |
| Self-oscillation tuning | Uncompensated | Tune resonance for accurate pitch | Medium |
| Oversampling | None | Add 2x oversampling option | Low |

### Detailed Recommendations

#### 1. Resonance Gain Compensation
**Current**: High resonance causes significant volume drop (Moog ladder characteristic).
**Issue**: Makes mixing difficult when sweeping resonance.
**Solution**: Apply input gain boost proportional to resonance.
**Expected Improvement**: More consistent levels during filter sweeps.

```javascript
// Gain compensation (empirically tuned)
const compensation = 1 + k * 0.5;  // k = resonance * 4
const input = (audioIn[i] / 5) * compensation;
```

#### 2. Per-Sample Cutoff Modulation
**Current**: `cvModVal = this.inputs.cutoffCV[0]` - uses only first sample.
**Issue**: Fast LFO or audio-rate filter FM is stepped/chunky.
**Solution**: Read CV per-sample like the audio input.
**Expected Improvement**: Smoother filter modulation, enables audio-rate FM.

```javascript
// Inside the sample loop:
const cvModVal = this.inputs.cutoffCV[i] || 0;
```

#### 3. Self-Oscillation Pitch Accuracy
**Current**: Resonant peak frequency drifts slightly from cutoff.
**Issue**: When self-oscillating, pitch doesn't perfectly track 1V/Oct.
**Solution**: Pre-warp the cutoff frequency accounting for resonance shift.
**Reference**: Zavalishin "The Art of VA Filter Design" Chapter 3.

---

## ADSR (Envelope Generator)

### Current Implementation
- One-pole exponential approach (RC charging curve)
- Attack overshoots to 5.5V for punchy peak
- Coefficient-based decay calculation

### Findings

| Issue | Current | Recommendation | Priority |
|-------|---------|----------------|----------|
| Attack curve | Fixed exponential | Add curve shape control | Medium |
| Minimum times | 2ms minimum | Allow sub-ms for clicks/transients | Low |
| Retrigger mode | Full restart | Add legato/resume option | Medium |
| CV inputs | None | Add CV modulation of ADSR times | High |

### Detailed Recommendations

#### 1. Attack Curve Shaping
**Current**: Fixed exponential curve via one-pole filter.
**Issue**: Can't achieve punchy linear attacks or slow logarithmic attacks.
**Solution**: Add curve parameter interpolating between log, linear, and exponential.
**Reference**: AS3310 datasheet offers multiple curve options.

```javascript
// Curve parameter: 0 = log, 0.5 = linear, 1 = exponential
function applyCurve(linear, curve) {
    if (curve < 0.5) {
        // Logarithmic (fast start, slow end)
        const amt = curve * 2;
        return Math.pow(linear, 1 + (1 - amt) * 2);
    } else {
        // Exponential (slow start, fast end)
        const amt = (curve - 0.5) * 2;
        return Math.pow(linear, 1 / (1 + amt * 2));
    }
}
```

#### 2. CV Inputs for Times
**Current**: No CV modulation of attack, decay, or release.
**Issue**: Can't create velocity-sensitive envelopes or evolving timbres.
**Solution**: Add CV inputs for A, D, R times (sustain already has level CV via gate).
**Expected Improvement**: Much more expressive patches.

---

## Drums (KICK, SNARE, HAT)

### KICK - Current Implementation
- Sine oscillator with pitch envelope
- Exponential amplitude decay
- Tanh soft clipping for tone

### Findings

| Issue | Current | Recommendation | Priority |
|-------|---------|----------------|----------|
| Pitch envelope | Fixed 2-octave sweep | Make sweep amount controllable | High |
| Click transient | None | Add initial click/transient | High |
| Sub-harmonic | None | Add sub-octave component | Medium |
| 808 authenticity | Generic sine | Consider bridged-T oscillator model | Low |

### Detailed Recommendations

#### 1. Controllable Pitch Sweep
**Current**: Fixed `PITCH_SWEEP_OCTAVES = 2`
**Solution**: Make this a parameter or add "Click" knob that controls sweep amount.
**Expected Improvement**: Range from subtle thump to zappy 808 kick.

#### 2. Click Transient
**Current**: Pure sine with no attack transient.
**Issue**: Lacks the initial "hit" of a drum stick impact.
**Solution**: Add short noise burst or impulse at trigger.
**Reference**: 808 has a distinct click from the bridged-T circuit.

```javascript
// On trigger, also set clickEnv = 1
let clickEnv = 0;
// Fast decay (1-2ms)
const click = (Math.random() * 2 - 1) * clickEnv;
sample += click * clickAmount;
clickEnv *= 0.95; // Very fast decay
```

### SNARE - Current Implementation
- Triangle oscillator + filtered noise
- Separate envelopes for body and noise
- Simple highpass on noise

### Findings

| Issue | Current | Recommendation | Priority |
|-------|---------|----------------|----------|
| Body oscillator | Single triangle | Add second oscillator for resonance | Medium |
| Noise filter | Simple HPF | Use bandpass for more accurate snare wire | High |
| Snare rattle | Missing | Add subtle ring modulation | Medium |

### Detailed Recommendations

#### 1. Improved Noise Filtering
**Current**: Simple DC-blocking highpass.
**Solution**: Use proper bandpass (1-5kHz) for snare wire character.
**Reference**: TR-909 uses lowpass-highpass chain for snare wires.

```javascript
// Bandpass for snare noise (around 2-4kHz)
const bpFreq = 3000;
const bpQ = 2;
// Use biquad bandpass coefficients
```

### HAT - Current Implementation
- 6 square wave oscillators at inharmonic ratios
- Bandpass filter for cymbal character
- Open/closed with choke

### Findings

| Issue | Current | Recommendation | Priority |
|-------|---------|----------------|----------|
| Square waves | Naive (aliased) | Apply PolyBLEP to hat oscillators | Medium |
| 808 frequencies | Approximate | Use authentic 808 frequencies | Low |
| Filter chain | Single bandpass | Add 808-style HPF chain | Medium |

### Detailed Recommendations

#### 1. Anti-Aliased Square Waves
**Current**: `metallic += oscPhases[o] < 0.5 ? 1 : -1` - naive squares.
**Issue**: At high sizzle settings, frequencies are high enough to alias.
**Solution**: Apply PolyBLEP to each of the 6 oscillators.
**Expected Improvement**: Cleaner high-frequency hats.

#### 2. Authentic 808 Frequencies
**Current**: `[205, 295, 370, 523, 620, 840]`
**808 Actual**: `[205.3, 304.4, 369.6, 522.7, 540, 800]`
**Solution**: Update to match 808 more closely (minor change).

---

## DLY (Digital Delay)

### Current Implementation
- Linear interpolation for fractional delay
- One-pole lowpass in feedback
- Dry/wet mix with CV

### Findings

| Issue | Current | Recommendation | Priority |
|-------|---------|----------------|----------|
| Interpolation | Linear | Consider allpass for cleaner modulation | Medium |
| Modulation depth | Full range | Add depth limiting to prevent artifacts | Low |
| Ping-pong | Not available | Add stereo ping-pong mode | Medium |
| Tape saturation | None | Add optional tape saturation | Low |

### Detailed Recommendations

#### 1. Allpass Interpolation
**Current**: Linear interpolation smooths time modulation.
**Issue**: Linear has slight low-pass effect on delayed signal.
**Solution**: Use first-order allpass interpolation (same cost, no filtering).
**Reference**: CCRMA Physical Audio Signal Processing.

```javascript
// Allpass interpolation coefficient
const d = frac; // fractional delay
const apCoeff = (1 - d) / (1 + d);
// y = apCoeff * (x - lastY) + lastX
```

---

## VERB (Stereo Reverb)

### Current Implementation
- Freeverb algorithm (8 comb + 4 allpass)
- Stereo spread via delay offset
- Damping in comb filter feedback

### Findings

| Issue | Current | Recommendation | Priority |
|-------|---------|----------------|----------|
| Early reflections | None | Add early reflection network | High |
| Modulation | None | Add subtle delay modulation | Medium |
| Pre-delay | None | Add pre-delay control | Medium |
| Density | Fixed | Make comb filter count adjustable | Low |

### Detailed Recommendations

#### 1. Early Reflections
**Current**: Only late reverb (comb + allpass).
**Issue**: Reverb sounds detached from source, lacks spatial cues.
**Solution**: Add 4-8 short delays (5-50ms) before the late reverb.
**Reference**: Dattorro plate reverb design.

```javascript
// Simple early reflections (multi-tap delay)
const earlyTaps = [0.011, 0.017, 0.023, 0.031, 0.041, 0.053];
let early = 0;
for (const tap of earlyTaps) {
    early += readDelay(tap * sampleRate) * 0.3;
}
```

#### 2. Delay Modulation
**Current**: Static delay times.
**Issue**: Reverb can sound metallic or "ringy".
**Solution**: Slowly modulate comb filter delay times by ±1-2 samples.
**Expected Improvement**: Smoother, more natural reverb tail.

---

## LFO (Low Frequency Oscillator)

### Current Implementation
- 8 waveforms via morphing
- Two frequency ranges (slow/fast)
- Reset input

### Findings

| Issue | Current | Recommendation | Priority |
|-------|---------|----------------|----------|
| CV processing | Per-buffer | Per-sample for audio rate use | Medium |
| Waveform aliasing | None at high speeds | Add anti-aliasing in fast mode | Low |
| Sync | Reset only | Add frequency sync option | Low |

### Detailed Recommendations

#### 1. Per-Sample CV Processing
**Current**: `const cvOct = clamp(this.inputs.rateCV[0] || 0, 0, 5)` - first sample only.
**Issue**: In fast mode, LFO can reach audio rates but modulation is stepped.
**Solution**: Process CV per-sample like the VCO does.

---

## NSE (Noise Generator)

### Current Implementation
- Math.random() white noise
- Downsample for lo-fi
- VCA mode with envelope

### Findings

| Issue | Current | Recommendation | Priority |
|-------|---------|----------------|----------|
| Noise quality | Math.random() | Use better PRNG (xorshift) | Low |
| Pink noise | Not available | Add pink/red noise option | Medium |
| VCA envelope | Linear | Use exponential for punchier bursts | Low |

### Detailed Recommendations

#### 1. Pink Noise Option
**Current**: White noise only.
**Issue**: Pink noise (1/f) is more useful for many synthesis applications.
**Solution**: Add filter bank or Voss-McCartney algorithm.
**Reference**: MusicDSP.org pink noise algorithms.

---

## Summary: Priority Implementation Order

### Critical (Fix First)
*None identified - modules are functional*

### High Priority
1. **VCF per-sample CV** - Enables audio-rate filter modulation
2. **Kick click transient** - Much punchier drums
3. **Kick pitch sweep control** - More versatile kick sounds
4. **VCF resonance compensation** - Consistent mixing levels
5. **ADSR CV inputs** - Essential for expressive patches
6. **Verb early reflections** - Much more natural reverb

### Medium Priority
1. VCO through-zero FM
2. VCO triangle PolyBLAMP
3. Snare bandpass noise filter
4. Hat anti-aliased oscillators
5. Delay allpass interpolation
6. Verb delay modulation
7. LFO per-sample CV

### Low Priority
1. VCO DC blocker
2. VCF oversampling
3. Delay tape saturation
4. Noise pink/red filter
5. Various minor refinements

---

## Testing Methodology

When implementing improvements:

1. **A/B Comparison** - Record before/after at same settings
2. **Frequency Analysis** - Check spectrum for aliasing reduction
3. **Modulation Tests** - Sweep parameters to check for artifacts
4. **CPU Profiling** - Ensure improvements don't impact performance
5. **Patch Compatibility** - Verify existing patches still sound correct

## References

- [CCRMA Physical Audio Signal Processing](https://ccrma.stanford.edu/~jos/pasp/)
- [Zavalishin: VA Filter Design](https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.0.pdf)
- [DAFx Paper Archive](https://dafx.de/paper-archive/)
- [MusicDSP.org](https://www.musicdsp.org/)
- Project research docs in `/research/modules/` and `/research/topics/`
