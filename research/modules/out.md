# Output Module (out)

## Hardware Reference
- **Based on**: Generic Eurorack output stage
- **ModularGrid**: Various output modules available

## Specifications

### Controls
- **Volume**: Master output level (0-100%)

### Inputs
- **L**: Left channel audio input
- **R**: Right channel audio input

### Outputs
- Connects to system audio (WebAudio destination)

### Indicators
- **L LED**: Left channel level meter
- **R LED**: Right channel level meter

## DSP Implementation

### Algorithm Overview
The output module bridges the modular synthesis engine to the WebAudio API:
1. Receives stereo audio buffers from the patch
2. Applies master volume scaling
3. Creates WebAudio buffer sources for playback
4. Updates LED meters based on peak levels

### Key Concepts
- **Buffer-based playback**: Creates new AudioBufferSourceNode each process cycle
- **Level metering**: Peak detection with visual feedback
- **Audio silence pattern**: Resets input buffers when cables disconnected

### Code Notes
- Uses `createBufferSource()` for sample-accurate playback
- LED levels normalized to 0-1 range (input ±5V / 5)
- Handles missing AudioContext gracefully for testing/SSR

## Sources
- [WebAudio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioBufferSourceNode - MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode)
