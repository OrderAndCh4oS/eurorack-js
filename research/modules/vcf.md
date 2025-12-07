# Voltage Controlled Filter (vcf)

## Hardware Reference
- **Based on**: Moog Transistor Ladder Filter topology
- **Algorithm**: Zero-delay feedback (ZDF) ladder implementation
- **ModularGrid**: [Various ladder filters](https://www.modulargrid.net/e/modules/browser?SearchName=ladder+filter)

## Specifications

### Features
- 24dB/octave (4-pole) low-pass filter
- Self-oscillation at high resonance
- Simultaneous LP, BP, HP outputs
- Cutoff CV modulation
- Resonance CV modulation
- Classic Moog-style sound character

### Controls
- **Cutoff**: Filter frequency (20Hz - 20kHz exponential)
- **Resonance**: Q/feedback amount (0 - 1.1, self-oscillates above 1.0)

### Inputs
- **Audio In**: Signal to filter (±5V)
- **Cutoff CV**: Frequency modulation (0-5V adds up to 2 octaves)
- **Res CV**: Resonance modulation (0-10V adds 0-1 to resonance)

### Outputs
- **LPF**: Low-pass output (±5V)
- **BPF**: Band-pass output (±5V)
- **HPF**: High-pass output (±5V)

### Indicators
- **Cutoff LED**: Shows current cutoff position

## Moog Ladder Filter Theory

### Analog Circuit
The original Moog ladder consists of:
- 4 cascaded transistor differential pairs
- Each pair acts as a one-pole lowpass filter
- Global negative feedback loop creates resonance
- At maximum feedback, the filter self-oscillates

### Frequency Response
| Poles | Slope | Character |
|-------|-------|-----------|
| 1-pole | 6dB/oct | Gentle |
| 2-pole | 12dB/oct | Moderate |
| 4-pole | 24dB/oct | Classic Moog |

### Resonance Behavior
- k = 0: No resonance, pure low-pass
- k = 1-3: Peaked response, emphasized harmonics
- k = 4: Self-oscillation begins (sine wave output)
- k > 4: Unstable (clipping required)

## DSP Implementation

### Zero-Delay Feedback Architecture
Our implementation uses the ZDF (Zero-Delay Feedback) approach:

```javascript
// Calculate filter coefficient from cutoff frequency
const fc = clamp(cutoffHz / sampleRate, 0.0001, 0.45);
const g = Math.tan(Math.PI * fc);  // Pre-warped cutoff
const G = g / (1 + g);             // One-pole gain coefficient
```

### Core Algorithm
```javascript
// Normalize input to ±1 range
const input = audioIn / 5;

// Get feedback from last stage
const feedback = delay[3];

// Apply soft clipping to feedback (tanh for analog character)
const clipFeedback = Math.tanh(feedback * k);  // k = resonance * 4
const u = input - clipFeedback;

// Process through 4 cascaded one-pole filters
for (let p = 0; p < 4; p++) {
    const prevStage = p === 0 ? u : stage[p - 1];
    const v = G * (prevStage - delay[p]);
    stage[p] = v + delay[p];
    delay[p] = stage[p] + v;  // Update delay element
}

// Output extraction
lpf = stage[3] * 5;                  // 4-pole lowpass
bpf = (stage[1] - stage[3]) * 5;     // Bandpass approximation
hpf = (u - stage[1]) * 5;            // Highpass approximation
```

### Cutoff Modulation
```javascript
// Exponential frequency mapping
const cutoffKnob = clamp(params.cutoff);
const cutoffHz = 20 * Math.pow(1000, cutoffKnob);  // 20Hz - 20kHz

// CV modulation (0-5V adds up to 2 octaves)
const cvMod = clamp(cutoffCV, 0, 5) / 5;
const modulatedHz = cutoffHz * Math.pow(4, cvMod);
```

### Resonance with Soft Clipping
```javascript
// Resonance range 0 to 1.1 (allows self-oscillation)
const res = clamp(resonance + resCV / 10, 0, 1.1);
const k = res * 4;  // Scale to feedback coefficient

// Soft clipping prevents runaway with tanh()
const clipFeedback = Math.tanh(feedback * k);
```

## Digital Implementation Methods

### Available Approaches

| Method | Accuracy | CPU | Stability |
|--------|----------|-----|-----------|
| Bilinear | Good | Low | Excellent |
| ZDF | Excellent | Medium | Excellent |
| Huovilainen | Excellent | High | Good |
| Naive IIR | Poor | Low | Variable |

### Why ZDF?
- No delay-free loop issues
- Accurate frequency response at high frequencies
- Maintains resonance peak position across cutoff range
- Stable self-oscillation behavior

### Huovilainen Method
Alternative approach using embedded nonlinearities:
```javascript
// Requires oversampling (2x-4x)
for (let p = 0; p < 4; p++) {
    stage[p] = tanh(input - k * stage[3]) * G + stage[p] * (1 - G);
}
```

## Filter Outputs

### Lowpass (LPF)
- Output of 4th stage
- -24dB/octave slope above cutoff
- Classic subtractive synthesis sound

### Bandpass (BPF)
- Difference between stages 2 and 4
- Peak at cutoff frequency
- Useful for resonant sweep effects

### Highpass (HPF)
- Difference between input and stage 2
- Passes frequencies above cutoff
- Useful for removing low-end mud

## DSP References
- [MoogLadders GitHub](https://github.com/ddiakopoulos/MoogLadders) - 9 C++ implementations
- [DAFx 2004: Non-Linear Moog Filter](https://dafx.de/paper-archive/2004/P_061.PDF) - Huovilainen paper
- [MusicDSP: Moog VCF](https://www.musicdsp.org/en/latest/Filters/24-moog-vcf.html) - Code examples
- [Vadim Zavalishin: TPT Filters](https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.0.pdf) - ZDF theory
- [KVR: ZDF Implementation](https://www.kvraudio.com/forum/viewtopic.php?t=571909) - Discussion

## Hardware References
- [Moog Ladder Analysis - All About Circuits](https://www.allaboutcircuits.com/technical-articles/analyzing-the-moog-filter/)
- [Bob Moog's Original Patent](https://patents.google.com/patent/US3475623A/)

## Potential Improvements
- Add filter type switch (LP, BP, HP, Notch)
- Implement variable slope (6/12/18/24 dB)
- Add drive/saturation control
- Implement MS-20 style filter alternative
- Add keytracking input

## Sources
- [MoogLadders Repository](https://github.com/ddiakopoulos/MoogLadders)
- [DAFx Paper Archive](https://dafx.de/paper-archive/)
- [MusicDSP.org](https://www.musicdsp.org/)
