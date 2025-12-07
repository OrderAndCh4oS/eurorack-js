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
downsampleFactor = 1 + (1 - rate)² × 500
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
