# Eurorack Emulator

Software Eurorack modular synthesizer. Modules pass voltages; sound only at output module.

## Voltage Standards

- **Audio**: ±5V | **Gates**: 0/10V | **Triggers**: 5-10ms pulse at 5-10V
- **Pitch CV**: 1V/octave (0V = base, +1V = +1 octave)
- **Thresholds**: Gates ≥1V, Clock >2.5V, Arp >0.4V, Pause >2V

## Project Structure

- `src/js/dsp/{module}.js` — DSP implementations
- `src/js/config/module-defs.js` — Module definitions (UI + DSP binding)
- `src/js/config/factory-patches.js` — Preset patches
- `tests/dsp/{module}.test.js` — Module tests

## Module Processing Order

Processing order is computed dynamically from cable connections using `computeProcessOrder()`:
- Sources process before destinations (topological sort)
- Ties broken by `MODULE_ORDER`: `clk → div → lfo → nse → sh → quant → arp → vco → vcf → adsr → vca → out`
- Cycles (feedback patches) fall back to `MODULE_ORDER`
- Recomputed when cables or modules change

## Researching a Module

1. Find official manual/PDF from manufacturer website
2. Check ModularGrid for specs and panel image
3. Document ALL: knobs, CV inputs, audio inputs, trigger inputs, outputs, switches, LEDs
4. Note voltage ranges, thresholds, and hidden modes
5. Cross-reference: manufacturer site, ModularGrid, retailer pages, demo videos

## Writing Tests (BEFORE implementation)

Tests go in `tests/dsp/{module}.test.js`. Test these categories:

1. **Initialization** — default params, buffers created, correct sizes
2. **Output ranges** — audio ±5V, gates 0/10V
3. **Each knob** — min/max behavior, effect on output
4. **Each CV input** — modulation response, voltage scaling
5. **Each trigger input** — edge detection, correct threshold
6. **Each switch/mode** — behavior in each position
7. **LEDs** — reflect module state
8. **Reset** — clears all internal state
9. **Buffer integrity** — no NaN, fills entire buffer
10. **Spec compliance** — matches manufacturer documentation

## DSP Module Structure

```javascript
export function createModule({ sampleRate = 44100, bufferSize = 512 } = {}) {
    return {
        params: { knob: 0.5, switch: 0 },
        inputs: { cv: new Float32Array(bufferSize) },
        outputs: { out: new Float32Array(bufferSize) },
        leds: { active: 0 },
        process() { /* fill outputs */ },
        reset() { /* clear state */ }
    };
}
```

## Common DSP Patterns

**Edge detection:**
```javascript
const rising = trig[i] >= 1 && lastTrig < 1;
lastTrig = trig[i];  // Update AFTER check
```

**V/Oct to frequency:**
```javascript
freq = baseFreq * Math.pow(2, vOct) * Math.pow(2, fine / 12);
```

**Slew limiting:** Use `createSlew()` from `src/js/utils/slew.js`

**PolyBLEP:** Apply at saw/pulse discontinuities for anti-aliasing

**Unpatched audio silence:** Two-part pattern ensures silence when cables are removed:
1. Module-level: Audio-path modules (output, VCA, VCF) reset inputs after `process()` IF replaced by routing: `if (this.inputs.x !== ownX) { ownX.fill(0); this.inputs.x = ownX; }`
2. Engine-level: `setCables()` zeroes disconnected audio inputs immediately when cables change

## Updating Patches

When module specs change (renamed/removed params, inputs, outputs, switches):
1. Search: `grep -n "moduleName" src/js/config/factory-patches.js`
2. Update all `knobs`, `switches`, and `cables` references

## Troubleshooting

- **NaN** — Guard division by zero, clamp inputs, test with `.every(v => !isNaN(v))`
- **Clicks** — Use slew for params, ensure envelopes end at zero, apply PolyBLEP
- **DC offset** — Test mean ≈ 0 for audio outputs
- **Trigger not firing** — Check threshold, ensure lastTrig updated AFTER edge check
- **CV delayed** — Check `engine.processOrder` to verify sources process before destinations

## Checklist

- [ ] All knobs with correct ranges
- [ ] All CV inputs with proper voltage scaling
- [ ] All audio/gate/trigger inputs
- [ ] All outputs producing correct voltage ranges
- [ ] All switches/modes
- [ ] LED indicators reflect state
- [ ] Matches manufacturer manual
- [ ] Tests passing
- [ ] Factory patches updated if specs changed

## Links

- [ModularGrid](https://modulargrid.net) — Module database
- [2hp](https://www.twohp.com/modules) — Official manuals
- [Mutable Instruments GitHub](https://github.com/pichenettes/eurorack) — Open source DSP
