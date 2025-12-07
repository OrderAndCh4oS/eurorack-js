# Slew Limiter (slew)

## Hardware Reference
- **Based on**: [Doepfer A-170](https://doepfer.de/a170.htm) (simplified)
- **Also referenced**: [ph modular Glide](https://phmodular.com/en/glide-2/), Mutable Instruments Stages
- **ModularGrid**: [Doepfer A-170](https://www.modulargrid.net/e/doepfer-a-170)

## Specifications

### Features
- 2 independent channels
- Adjustable slew rate per channel (0ms to ~2 seconds)
- CV control of slew rate
- LED shows output level
- Simple one-pole RC filter (same as our existing slew utility)

### Hardware Reference (Doepfer A-170)
- Width: 8HP
- +12V: 20mA, -12V: 20mA
- Slew time range: 0-10 seconds
- Upper unit: shared rise/fall control
- Lower unit: separate rise/fall controls

### Our Implementation (Simplified)
- Width: 4HP
- 2 channels with shared rise/fall per channel
- Slew range: 0ms to 2000ms (musical range)
- CV input to modulate slew time

### Controls
- **Rate 1**: Slew time channel 1 (0ms to 2000ms)
- **Rate 2**: Slew time channel 2 (0ms to 2000ms)

### Inputs
- **In 1**: Signal input channel 1
- **In 2**: Signal input channel 2
- **CV 1**: Rate CV channel 1 (adds to knob value)
- **CV 2**: Rate CV channel 2 (adds to knob value)

### Outputs
- **Out 1**: Slewed signal channel 1
- **Out 2**: Slewed signal channel 2

### Indicators
- **Ch1 LED**: Shows output level
- **Ch2 LED**: Shows output level

## DSP Implementation

### Algorithm Overview
One-pole RC lowpass filter (already implemented in `src/js/utils/slew.js`):

```javascript
// RC coefficient based on time constant
coeff = 1 - Math.exp(-1000 / (sampleRate * timeMs));

// Process each sample
state += coeff * (input - state);
output = state;
```

### Rate CV Scaling
CV adds to knob value, scaled appropriately:
```javascript
// Knob: 0-1 maps to 0-2000ms
// CV: ±5V maps to ±1000ms
const baseRate = knob * 2000;
const cvRate = cv * 200;  // 5V = +1000ms
const totalRate = Math.max(0.1, baseRate + cvRate);
```

### Key Concepts
- **Slew limiting**: Limits the rate of change of a signal
- **One-pole filter**: Simple RC circuit, smooth exponential response
- **Portamento**: When applied to pitch CV, creates glide between notes
- **Envelope smoothing**: Softens sharp transients from gates/triggers

## Common Uses

### Portamento/Glide
- Input: Pitch CV from sequencer
- Output: Smoothed pitch CV to VCO
- Result: Notes slide into each other

### Gate to Envelope
- Input: Gate signal (0/10V)
- Output: Smoothed ramp
- Result: Simple attack-release envelope

### Smoothing Stepped CV
- Input: S+H or quantizer output
- Output: Smoothed transitions
- Result: Less abrupt modulation

### Taming Random CV
- Input: Noise through S+H
- Output: Wandering smooth CV
- Result: Organic, slowly-evolving modulation

## Design Decisions

### Why Shared Rise/Fall (not Separate)?
- Keeps module simple and small (4HP)
- Most use cases don't need separate rise/fall
- ADSR already provides attack/release control
- Can add separate rise/fall version later if needed

### Why CV Control?
- Allows dynamic portamento (faster for large intervals)
- Can modulate slew time rhythmically
- Matches hardware modules like A-170

### Why 2 Seconds Max (not 10)?
- 2 seconds covers most musical use cases
- Longer times are rarely needed for portamento
- Keeps knob resolution useful across range

## DSP References
- [One-pole filter - Wikipedia](https://en.wikipedia.org/wiki/Low-pass_filter#RC_filter)
- [Slew limiter - Wikipedia](https://en.wikipedia.org/wiki/Slew_rate)
- Our existing implementation: `src/js/utils/slew.js`

## Sources
- [Doepfer A-170](https://doepfer.de/a170.htm)
- [ModularGrid - A-170](https://www.modulargrid.net/e/doepfer-a-170)
- [ph modular Glide](https://phmodular.com/en/glide-2/)
- [Mutable Instruments Stages](https://pichenettes.github.io/mutable-instruments-documentation/modules/stages/)
