# Envelope Follower Module Research

## Overview
Envelope follower that tracks audio amplitude and outputs CV. Converts audio dynamics into control voltage for modulating VCAs, VCFs, and other parameters.

## Sources
- [Plankton Electronics ENVF](https://planktonelectronics.com/store/envf/)
- [ModularGrid - ENVF](https://modulargrid.net/e/plankton-electronics-envf)
- [MusicDSP - Envelope Follower Algorithm](https://www.musicdsp.org/en/latest/Analysis/136-envelope-follower-with-different-attack-and-release.html)
- [BeepBoop Electronics 2hp Envelope Follower](https://modulargrid.net/e/beepboop-electronics-2hp-envelope-follower)

## Specifications (based on Plankton ENVF)
- Width: 2hp
- Depth: 35mm
- Power: 14mA +12V, 13mA -12V

## Panel Layout
- THRESH knob - Threshold level for detection (with LED indicator)
- GAIN knob - Output amplitude
- SLOPE switch - Fast/Slow response
- IN input - Audio input
- OUT output - Envelope CV (0-10V)
- INV output - Inverted envelope CV

## Functionality

### Core Behavior
- Takes audio input and outputs DC voltage following amplitude
- Output rises when input amplitude increases
- Output falls when input amplitude decreases
- Useful for sidechain effects, ducking, dynamics control

### Controls

**Threshold**: Sets minimum amplitude for envelope to respond. Below threshold = no output. LED indicates when signal crosses threshold.

**Gain**: Scales the output envelope. Allows matching output level to target CV input range.

**Slope (Fast/Slow)**:
- FAST: Tracks minor amplitude changes (e.g., filter resonance blips)
- SLOW: Only follows major changes (e.g., kick drum shape)

### Outputs
- Normal: 0V when quiet, rises with amplitude
- Inverted: Opposite - high when quiet, drops with amplitude (for ducking)

## DSP Implementation

### Algorithm (from MusicDSP)
```javascript
// Coefficient calculation
attack_coef = Math.exp(Math.log(0.01) / (attack_ms * sampleRate * 0.001));
release_coef = Math.exp(Math.log(0.01) / (release_ms * sampleRate * 0.001));

// Per-sample processing
const tmp = Math.abs(input);
if (tmp > envelope) {
    envelope = attack_coef * (envelope - tmp) + tmp;
} else {
    envelope = release_coef * (envelope - tmp) + tmp;
}
```

### Simplified coefficient
```javascript
coef = Math.pow(0.01, 1.0 / (time_ms * sampleRate * 0.001));
```

### Time Definition
Attack/release = time for envelope to go from 100% to 1% (about 4.6 time constants).

### Threshold Implementation
```javascript
const rectified = Math.abs(input);
if (rectified < threshold) {
    // Don't update envelope, or decay towards zero
}
```

## Implementation Notes

### Slope Switch Timing
- FAST: Attack ~1ms, Release ~10ms
- SLOW: Attack ~10ms, Release ~100ms

### Output Voltage Range
- Normal output: 0V to 10V
- Inverted output: 10V to 0V (or -5V to +5V bipolar)

### LED Indicators
- Threshold LED: On when input exceeds threshold
- Output LEDs: Brightness follows envelope level

## Use Cases
1. **Sidechain compression** - Kick triggers ducking of bass/pad
2. **Auto-wah** - Envelope → filter cutoff for dynamic filtering
3. **Dynamics control** - Envelope → VCA for compression/expansion
4. **Trigger extraction** - Use threshold to generate gates from audio
5. **Reactive effects** - Modulate delay/reverb based on input level

## Design Decisions

For our implementation:
- **Threshold knob**: 0-1 maps to 0-5V threshold
- **Gain knob**: 0-1 maps to 0-2x output scaling
- **Slope switch**: 2-position (Fast/Slow)
- **Outputs**: env (0-10V), inv (inverted)
- **LED**: Shows when threshold is crossed
