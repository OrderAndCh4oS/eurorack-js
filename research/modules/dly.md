# Digital Delay (dly)

## Hardware Reference
- **Based on**: [2hp Delay](https://www.twohp.com/modules/p/delay)
- **ModularGrid**: [2hp Delay](https://www.modulargrid.net/e/2hp-delay)

## Specifications

### Features
- Digital delay line with feedback
- Time range: 0ms to 1000ms
- CV modulation of all parameters
- Linear interpolation for smooth time modulation
- One-pole lowpass in feedback path (tape/analog character)

### Controls
- **Time**: Delay time (0-1 maps to 0ms-1000ms)
- **Feedback**: Repeat amount (0-0.99, approaches infinite at max)
- **Mix**: Dry/wet balance (0 = dry, 1 = wet)

### Inputs
- **Audio In**: Signal to delay (±5V)
- **Time CV**: Delay time modulation (±5V = ±0.5 range)
- **Feedback CV**: Feedback modulation (±5V = ±0.5 range)
- **Mix CV**: Mix modulation (±5V = ±0.5 range)

### Outputs
- **Out**: Processed audio output (±5V)

### Indicators
- **Active LED**: Shows output level

## Delay Line Theory

### Digital Delay Basics
A digital delay line stores samples in a circular buffer and reads from a position behind the write pointer:

```
Write Index ───►┌───┬───┬───┬───┬───┬───┬───┬───┐
                │ n │n+1│n+2│n+3│n+4│n+5│n+6│n+7│
                └───┴───┴───┴───┴───┴───┴───┴───┘
                              ▲
Read Index ───────────────────┘ (delay = 3 samples)
```

### Fractional Delay and Interpolation
When delay time doesn't align to sample boundaries, **linear interpolation** prevents zipper noise:

```javascript
// Calculate fractional read position
const readIndexFloat = writeIndex - delaySamples;
const readIndexFloor = Math.floor(readIndexFloat);
const frac = readIndexFloat - readIndexFloor;

// Wrap indices into buffer
let idx0 = readIndexFloor % bufferSize;
let idx1 = (readIndexFloor + 1) % bufferSize;
if (idx0 < 0) idx0 += bufferSize;
if (idx1 < 0) idx1 += bufferSize;

// Linear interpolation
const delayedSample = buffer[idx0] * (1 - frac) + buffer[idx1] * frac;
```

### Why Interpolation Matters
- **Without**: Audible stepping artifacts when time changes
- **Linear**: Good quality, low CPU cost
- **Allpass**: Better for feedback loops (no gain distortion)
- **Lagrange/Sinc**: Higher quality, more CPU cost

## DSP Implementation

### Canonical Delay Structure
The correct order of operations:
1. **Read** from delay buffer (interpolated)
2. **Output** mix of dry input and wet delayed
3. **Filter** the feedback signal
4. **Write** input + filtered feedback to buffer

```javascript
// 1. Read with linear interpolation
const delayedSample = lerp(buffer[idx0], buffer[idx1], frac);

// 2. Output: dry/wet mix
out[i] = input * (1 - mix) + delayedSample * mix;

// 3. Filter feedback (one-pole lowpass)
dampState = dampState + dampCoeff * (delayedSample - dampState);

// 4. Write to buffer: input + damped feedback
buffer[writeIndex] = input + dampState * feedback;

// 5. Advance write position
writeIndex = (writeIndex + 1) % bufferSize;
```

### Feedback Path Lowpass
Simulates tape/analog delay character where high frequencies decay faster:

```javascript
// One-pole lowpass filter
// dampCoeff = 0.7 (0 = fully filtered, 1 = no filtering)
dampState = dampState + dampCoeff * (delayedSample - dampState);
```

### Buffer Sizing
```javascript
const MAX_DELAY_TIME = 1.0; // seconds
const bufferSize = Math.ceil(sampleRate * MAX_DELAY_TIME) + bufferSize;
```

## Delay Types Comparison

| Type | Character | Implementation |
|------|-----------|----------------|
| Digital | Clean, precise | Direct delay line |
| Tape | Warm, degrading | Lowpass in feedback + saturation |
| Analog (BBD) | Dark, lo-fi | Lowpass + noise + pitch wobble |
| Ping-pong | Stereo bouncing | Two delays, cross-feedback |

## Classic Delay Times

| Tempo (BPM) | 1/4 Note | 1/8 Note | 1/16 Note | Dotted 1/8 |
|-------------|----------|----------|-----------|------------|
| 60 | 1000ms | 500ms | 250ms | 750ms |
| 90 | 667ms | 333ms | 167ms | 500ms |
| 120 | 500ms | 250ms | 125ms | 375ms |
| 140 | 429ms | 214ms | 107ms | 321ms |

### Sweet Spots
| Effect | Time | Feedback | Mix |
|--------|------|----------|-----|
| Slapback | 0.1-0.15 | 0.2 | 0.5 |
| Echo | 0.3-0.5 | 0.4-0.6 | 0.4 |
| Dub | 0.4-0.6 | 0.7-0.9 | 0.5 |
| Ambient | 0.5-0.8 | 0.6-0.8 | 0.6 |

## DSP References
- [CCRMA: Delay-Line Interpolation](https://ccrma.stanford.edu/~jos/pasp/Delay_Line_Interpolation.html) - Julius O. Smith
- [DSPRelated: Delay Line Interpolation](https://www.dsprelated.com/freebooks/pasp/Delay_Line_Interpolation.html)
- [CCRMA: Effect Design Part 2](https://ccrma.stanford.edu/~dattorro/EffectDesignPart2.pdf) - Dattorro
- [Digital Delay Line - Wikipedia](https://en.wikipedia.org/wiki/Digital_delay_line)

## Hardware References
- [2hp Delay Product Page](https://www.twohp.com/modules/p/delay)
- [STK DelayL Class](https://ccrma.stanford.edu/software/stk/classstk_1_1DelayL.html)

## Potential Improvements
- Add tap tempo / clock sync input
- Implement ping-pong stereo mode
- Add tape saturation / wow & flutter
- Implement reverse delay mode
- Add freeze/infinite hold function
- Higher-order interpolation (Lagrange/sinc)

## Sources
- [2hp Delay](https://www.twohp.com/modules/p/delay)
- [ModularGrid - 2hp Delay](https://www.modulargrid.net/e/2hp-delay)
- [CCRMA Physical Audio Signal Processing](https://ccrma.stanford.edu/~jos/pasp/)
