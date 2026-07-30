# 2hp Logic Module Research

## Overview
Logic provides separate two-input AND and OR gate operators.

## Sources
- [2hp Official](https://www.twohp.com/modules/p/logic)
- [2hp Logic Manual](https://www.twohp.com/s/Logic_Manual.pdf) - primary
  panel/electrical source: four inputs, >2.5 V comparators, 0-5 V outputs, and
  AND-to-OR input normalization.
- [ModularGrid](https://modulargrid.net/e/2hp-logic)
- [Elevator Sound](https://www.elevatorsound.com/product/2hp-logic-and-or/)

## Specifications
- Width: 2hp
- Depth: 42-45mm
- Power: 35mA +12V, 3mA -12V

## Panel Layout (top to bottom)
- AND IN A/B - independent inputs for the AND operator
- OR IN A/B - independent inputs for the OR operator
- AND - Output jack (high when both inputs high)
- OR - Output jack (high when either input high)

## Functionality

### AND Output
- High (5V) when BOTH AND inputs are above 2.5V
- Low (0V) otherwise
- Use case: Gating rhythmic events - only triggers when two patterns coincide

### OR Output
- High (5V) when EITHER OR input is above 2.5V
- Low (0V) when both inputs are low
- Use case: Combining two rhythmic patterns into one stream

### Normalling
- AND IN A/B normal respectively to OR IN A/B while the corresponding OR input
  is unpatched. Cable state, not instantaneous voltage, controls the normal.

## Voltage Thresholds
The manufacturer manual specifies strictly above 2.5V as HIGH.

## Implementation Notes

### DSP Approach
- Sample-by-sample boolean logic
- No edge detection needed - just compare voltage levels
- Output the documented 5V gate or 0V

### Considerations
- Should handle both gates (sustained high) and triggers (brief pulses)
- No smoothing/slew needed - instant response
- LED indicators for AND and OR outputs

## Use Cases
1. **Rhythmic gating**: AND two clock divisions to create polyrhythms
2. **Pattern combination**: OR euclidean + sequencer gates for complex rhythms
3. **Conditional triggers**: AND a gate with clock for gated rhythms
4. **Event merging**: OR multiple trigger sources to single destination

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/logic.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- Primary-manual review found the prior app and research contract was wrong:
  DSP shared two inputs between AND/OR, used a >=1 V comparator, and emitted
  10 V. The hardware contract is four independent inputs, strictly >2.5 V, and
  0/5 V outputs.
- DSP/UI now expose `andA`, `andB`, `orA`, and `orB`. AND A/B normal to OR A/B
  by cable lifecycle state; patched 0 V remains 0 V. The factory Logic patch
  fans both Euclidean sources to the two operators using the corrected ports.
- Focused truth tables cover comparator boundaries, simultaneous/per-sample
  events, both normals and disconnect, LED activity, exact gate rails, stable
  buffers, and full reset.
- Contract, factory-patch, and patch-format validation pass. The strict
  44.1/48/96 kHz by 128/512 matrix is finite and stable with zero voltage flags
  and an exact 5.000 V peak.
