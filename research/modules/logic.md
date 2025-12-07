# 2hp Logic Module Research

## Overview
Logic is a 2-channel boolean gate operator providing AND and OR logic operations for gate/trigger signals.

## Sources
- [2hp Official](https://www.twohp.com/modules/p/logic)
- [ModularGrid](https://modulargrid.net/e/2hp-logic)
- [Elevator Sound](https://www.elevatorsound.com/product/2hp-logic-and-or/)

## Specifications
- Width: 2hp
- Depth: 42-45mm
- Power: 35mA +12V, 3mA -12V

## Panel Layout (top to bottom)
- IN 1 - Input jack for channel 1
- IN 2 - Input jack for channel 2
- AND - Output jack (high when both inputs high)
- OR - Output jack (high when either input high)

## Functionality

### AND Output
- High (10V) when BOTH IN 1 AND IN 2 are high
- Low (0V) otherwise
- Use case: Gating rhythmic events - only triggers when two patterns coincide

### OR Output
- High (10V) when EITHER IN 1 OR IN 2 (or both) are high
- Low (0V) when both inputs are low
- Use case: Combining two rhythmic patterns into one stream

### Normalling
- Channel 1 normals to channel 2 when no cable is present in IN 1
- This means with only IN 2 patched:
  - AND output = IN 2 (since IN 1 copies IN 2)
  - OR output = IN 2 (same signal ORed with itself)

## Voltage Thresholds
Standard Eurorack gate threshold: signals >= 1V considered HIGH

## Implementation Notes

### DSP Approach
- Sample-by-sample boolean logic
- No edge detection needed - just compare voltage levels
- Output full gate voltage (10V) or 0V

### Considerations
- Should handle both gates (sustained high) and triggers (brief pulses)
- No smoothing/slew needed - instant response
- LED indicators for AND and OR outputs

## Use Cases
1. **Rhythmic gating**: AND two clock divisions to create polyrhythms
2. **Pattern combination**: OR euclidean + sequencer gates for complex rhythms
3. **Conditional triggers**: AND a gate with clock for gated rhythms
4. **Event merging**: OR multiple trigger sources to single destination
