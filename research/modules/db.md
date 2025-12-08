# dB Meter Module Research

## Overview

A VU/dB meter module provides visual feedback of signal levels. Essential for monitoring audio levels, calibrating patches, and preventing clipping.

## Real-World Eurorack Modules

### Wavefonix Dual VU Meter
- **HP**: 6
- **Channels**: 2 stereo
- **Type**: Analog VU meters
- **Calibration**: +4dBU at 0dB (adjustable for modular ±5V)
- **Features**: Thru outputs, adjustable range per channel
- **Power**: 70mA +12V, 10mA -12V

### VOID Modular LED VU Meter
- **HP**: 2
- **Type**: LED bargraph (based on Electric Druid code)
- **Status**: Discontinued

### NoisyFruitsLab VU (4HP)
- **HP**: 4
- **Channels**: Dual mono in/out, or mono in "stereo" out
- **Type**: Analog VU meters
- **Calibration**: 0dB = ±5V (Eurorack standard)
- **Features**: Rear trim pots for calibration
- **Power**: 75mA +12V, 8mA -12V

### NoisyFruitsLab RGB VU Meter (2HP)
- **HP**: 2
- **Channels**: 1 input
- **LEDs**: 10 RGB LEDs
- **Voltage Ranges**: 0-5V standard, 0-10V extended
- **Features**:
  - 25 color schemes
  - Dot mode (peak indicator)
  - Inactivity animation
  - EEPROM memory for settings
- **Power**: 43mA +12V, 4mA -12V

### SynQuaNon Hex VU Meter
- **HP**: 10
- **Channels**: 6 inputs
- **Features**: AGC, peak hold, rear gain controls
- **Power**: 51mA +12V

## VU Meter vs Peak Meter

### VU Meter (Volume Unit)
- Developed 1939 by CBS, NBC, Bell Labs
- **Response**: 300ms to reach 99% full-scale (slow, averaging)
- **Scale**: -20 VU to +3 VU
- **Reference**: 0 VU = +4 dBu = 1.228V RMS
- **Behavior**: Shows average signal voltage, approximates perceived loudness
- **Limitation**: Peaks are typically 6-10dB higher than displayed

### PPM (Peak Programme Meter)
- Developed 1932
- **Response**: 5ms integration time (fast, peak-detecting)
- **Fallback**: 1.5+ seconds to fall 20dB (slow decay for readability)
- **Scale**: Logarithmic (linear in dB)
- **Standards**: BBC, EBU, DIN, Nordic variants

### Modern Standards
- **ITU-R BS1770**: LUFS loudness + True Peak metering
- **EBU R68**: Alignment at -18 dBFS
- **SMPTE RP 0155**: Alignment at -20 dBFS

## Design Decisions for Our Module

### Recommended: Dual VU with Peak Hold (4HP)

**Rationale**:
- Stereo monitoring is essential for final output
- VU-style averaging shows perceived loudness
- Peak hold prevents missing transients
- Matches our ±5V audio standard

### Specifications

| Spec | Value |
|------|-------|
| HP | 4 |
| Channels | 2 (stereo) |
| LEDs per channel | 8 |
| Range | -30dB to +6dB |
| 0dB reference | 5V peak (our audio standard) |
| Response | VU-style (300ms attack) |
| Peak hold | 1 second decay |

### Inputs
- `L` - Left channel audio input
- `R` - Right channel audio input

### Outputs
- `L` - Left thru output (buffered)
- `R` - Right thru output (buffered)

### LED Scale (per channel)
```
+6dB  - Red (clip)
+3dB  - Red
 0dB  - Yellow (reference = 5V)
-3dB  - Yellow
-6dB  - Green
-12dB - Green
-18dB - Green
-30dB - Green
```

### Controls
- **Mode switch**: VU (averaging) / Peak / Both
- **Hold switch**: Peak hold on/off

### DSP Notes

**VU Metering (RMS-based)**:
```javascript
// 300ms attack/release for VU-style response
const vuCoeff = Math.exp(-1 / (sampleRate * 0.3));
rmsLevel = vuCoeff * rmsLevel + (1 - vuCoeff) * sample * sample;
dbLevel = 10 * Math.log10(rmsLevel);
```

**Peak Detection**:
```javascript
// Fast attack, slow decay
const peakAttack = 0; // instant
const peakRelease = Math.exp(-1 / (sampleRate * 1.5)); // 1.5s decay
peak = Math.max(Math.abs(sample), peak * peakRelease);
```

**dB to LED mapping**:
```javascript
// Map dB level to LED index (0-7)
// -30dB to +6dB range (36dB total)
const ledIndex = Math.floor((dbLevel + 30) / 4.5);
```

## Sources

- [Wavefonix Dual VU Meter - ModularGrid](https://modulargrid.net/e/wavefonix-dual-vu-meter)
- [VOID Modular LED VU Meter - ModularGrid](https://modulargrid.net/e/void-modular-led-vu-meter)
- [NoisyFruitsLab VU - ModularGrid](https://modulargrid.net/e/noisyfruitslab-vu-)
- [NoisyFruitsLab RGB VU Meter](https://noisyfruitslab.com/?p=6448)
- [SynQuaNon Hex VU Meter - ModularGrid](https://modulargrid.net/e/synquanon-hex-vu-meter)
- [Sound On Sound - VU vs PPM](https://www.soundonsound.com/sound-advice/q-whats-difference-between-ppm-and-vu-meters)
- [Sound On Sound - Mysteries of Metering](https://www.soundonsound.com/techniques/mysteries-metering)
