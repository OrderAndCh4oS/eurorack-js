# Flanger Module Research

## Overview

Flanger effect using very short modulated delay with feedback. Creates sweeping comb filter effect.

## References

- [DSPRelated - Flanging](https://www.dsprelated.com/freebooks/pasp/Flanging.html)
- [Stanford CCRMA - Flanger](https://ccrma.stanford.edu/~spencer/blog/2013/03/05/flanger/)
- [Wikipedia - Flanging](https://en.wikipedia.org/wiki/Flanging)

## Algorithm

Similar to chorus but with:
- Shorter delay (0.1-10ms vs 20-50ms for chorus)
- Higher feedback for resonance
- Creates harmonic comb filter notches

```
output = dry + delayLine[modulatedDelay] * wetMix
delayLine.write(input + output * feedback)
```

### Key Parameters
- **Rate**: LFO speed (0.01-2 Hz typical)
- **Depth**: Delay modulation amount
- **Delay**: Base delay (0.5-5ms)
- **Feedback**: Recirculation (-1 to 1, negative inverts)
- **Mix**: Dry/wet balance

### Flanger vs Chorus
- Flanger: <10ms delay, high feedback, comb filter
- Chorus: 20-60ms delay, low/no feedback, detuning

## DSP Implementation

```javascript
// Per sample:
const lfo = Math.sin(phase) * depth;
const delay = baseDelay + lfo; // in samples

const wet = readDelayInterpolated(delayLine, delay);
const output = dry + wet * wetMix;

// Write with feedback
delayLine.write(input + wet * feedback);

phase += 2 * Math.PI * rate / sampleRate;
```

### Feedback Polarity
Positive feedback emphasizes harmonics.
Negative feedback emphasizes odd harmonics (more hollow sound).
