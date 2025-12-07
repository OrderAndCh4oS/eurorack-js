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
const pos = waveKnob * 4  // 0-4 across 4 waveforms
const idx = Math.floor(pos) % 4
const frac = pos - Math.floor(pos)
output = (1 - frac) * wave[idx](t) + frac * wave[idx+1](t)
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
