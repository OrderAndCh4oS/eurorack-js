# Eurorack Emulator

Software Eurorack modular synthesizer. Modules pass voltages; sound only at output module.

## Voltage Standards

- **Audio**: ±5V | **Gates**: 0/10V | **Triggers**: 5-10ms pulse at 5-10V
- **Pitch CV**: 1V/octave (0V = base, +1V = +1 octave)
- **Thresholds**: Gates ≥1V, Clock >2.5V, Arp >0.4V, Pause >2V

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         index.html                          │
│                    (App initialization)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────────────────────────┐
│  audio/engine   │     │            rack/rack.js             │
│  (DSP loop)     │◄───►│    (Orchestrates UI + routing)      │
└────────┬────────┘     └──────────────┬──────────────────────┘
         │                             │
         │              ┌──────────────┼──────────────┐
         │              ▼              ▼              ▼
         │      ┌───────────┐  ┌───────────┐  ┌───────────┐
         └─────►│  modules/ │  │  modules/ │  │  modules/ │
                │  vco/     │  │  vcf/     │  │  ...      │
                │  index.js │  │  index.js │  │  index.js │
                └───────────┘  └───────────┘  └───────────┘
                     │              │              │
                     └──────────────┴──────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
              ┌─────────────┐              ┌─────────────┐
              │rack/registry│              │ ui/renderer │
              │  (lookup)   │              │  (UI gen)   │
              └─────────────┘              └──────┬──────┘
                                                  │
                                           ┌──────┴──────┐
                                           ▼             ▼
                                    ┌────────────┐  ┌─────────────┐
                                    │ui/toolkit/ │  │ ui/toolkit/ │
                                    │ components │  │   layout    │
                                    └────────────┘  └─────────────┘
```

**Self-contained modules**: Each module folder contains DSP + UI definition in one file. Modules export metadata, `createDSP()` factory, and declarative `ui` config.

**Available modules**: `midi-cv` (mono MIDI-CV) · `midi-4` (4-voice poly MIDI) · `midi-cc` (CC to CV) · `midi-clk` (MIDI clock) · `midi-drum` (drum pads to triggers) · `clk` (clock) · `div` (divider) · `lfo` · `nse` (noise) · `sh` (sample&hold) · `quant` (quantizer) · `arp` (arpeggiator) · `seq` (sequencer) · `euclid` (euclidean rhythm) · `logic` (AND/OR gates) · `mult` (signal splitter) · `vco` · `vcf` · `fold` (wavefolder) · `ring` (ring mod) · `rnd` (random) · `envf` (envelope follower) · `func` (function generator) · `adsr` · `vca` · `atten` (attenuverter) · `slew` · `mix` · `dly` (delay) · `verb` (reverb) · `chorus` · `phaser` · `flanger` · `crush` (bit crusher) · `granulita` (granular chord) · `db` (VU meter) · `pwm` (pulse width mod) · `turing` (random looping seq) · `ochd` (8x LFO) · `cmp2` (window comparator) · `kick` · `snare` · `hat` · `scope` · `spectrum` (FFT analyzer) · `plot` (waveform plotter) · `spectrogram` (freq over time) · `out`

## Project Structure

```
src/js/
├── index.js               # Main entry point
├── rack/                  # Rack infrastructure
│   ├── rack.js            # Rack orchestration
│   └── registry.js        # Module lookup & validation
├── ui/
│   ├── renderer.js        # Declarative UI → DOM
│   └── toolkit/           # UI component factories
│       ├── components.js  # Knobs, jacks, switches, LEDs
│       ├── layout.js      # Panels, rows, sections
│       └── interactions.js # Drag handling
├── modules/               # Self-contained modules
│   └── {moduleId}/
│       └── index.js       # DSP + UI definition
├── audio/engine.js        # DSP processing loop
├── config/factory-patches.js
└── patches/               # Patch serialization

tests/dsp/{module}.test.js # Module tests
```

## Module Processing Order

Processing order is computed dynamically from cable connections using `computeProcessOrder()`:
- Sources process before destinations (topological sort)
- Ties broken by `MODULE_ORDER`: `clk → div → lfo → nse → sh → quant → arp → seq → euclid → logic → mult → vco → vcf → fold → ring → rnd → envf → func → adsr → vca → atten → slew → dly → verb → chorus → phaser → flanger → crush → granulita → db → pwm → turing → ochd → cmp2 → kick → snare → hat → mix → scope → out`
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

## Self-Contained Module Structure

```javascript
// src/js/modules/{moduleId}/index.js
export default {
    // Metadata
    id: 'moduleId',
    name: 'Module Name',
    hp: 4,                    // Panel width
    color: '#8b4513',         // Header color
    category: 'source',       // source | modulator | utility | effect

    // DSP factory
    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        return {
            params: { knob: 0.5, switch: 0 },
            inputs: { cv: new Float32Array(bufferSize) },
            outputs: { out },
            leds: { active: 0 },
            process() { /* fill outputs */ },
            reset() { /* clear state */ }
        };
    },

    // Declarative UI
    ui: {
        leds: ['active'],
        knobs: [{ id: 'knob', label: 'Knob', param: 'knob', min: 0, max: 1, default: 0.5 }],
        switches: [{ id: 'switch', label: 'Mode', param: 'switch', default: 0 }],
        inputs: [{ id: 'cv', label: 'CV', port: 'cv', type: 'cv' }],
        outputs: [{ id: 'out', label: 'Out', port: 'out', type: 'audio' }]
    }
};
```

**Port types**: `audio` | `cv` | `gate` | `trigger` | `buffer`

## Registering a New Module

After creating `src/js/modules/{moduleId}/index.js`, register it in two places:

1. **Add import to `src/js/rack/registry.js`** in `loadModules()`:
```javascript
import('../modules/{moduleId}/index.js'),
```

2. **Add to `src/js/index.js`** in `DEFAULT_MODULE_ORDER` array (determines processing order and sidebar position)

3. **Update documentation**:
   - Add to `CLAUDE.md` available modules list
   - Add to `CLAUDE.md` port reference table
   - Add to `README.md` module table

4. **Create test patch** in `src/js/config/patches/test-{moduleId}.js`

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

## Writing Patches

Patches are stored in `src/js/config/patches/`. Each patch file exports:

```javascript
export default {
    name: 'Patch Name',
    factory: true,
    state: {
        modules: [
            // type = module id (e.g., 'lfo', 'vco')
            // instanceId = your chosen name for THIS instance (used in knobs/cables)
            { type: 'lfo', instanceId: 'lfo1', row: 1 },
            { type: 'lfo', instanceId: 'lfo2', row: 1 },  // Can have multiple of same type
            { type: 'vco', instanceId: 'vco', row: 1 },
        ],
        knobs: {
            // Keys match instanceId, not type
            lfo1: { rateKnob: 0.5 },
            lfo2: { rateKnob: 0.2 },
            vco: { coarse: 0.35, fine: 0 }
        },
        switches: {
            lfo1: { range: 0 }
        },
        cables: [
            // fromModule/toModule = instanceId
            // fromPort/toPort = port name from module definition
            { fromModule: 'lfo1', fromPort: 'primary', toModule: 'vco', toPort: 'vOct' }
        ]
    }
};
```

**Key distinctions:**
- `type` = Module id (from module's `id` field, e.g., `'lfo'`, `'vco'`)
- `instanceId` = Your name for this instance (used in `knobs`, `switches`, `cables`)
- `fromPort`/`toPort` = Port name from module's `ui.inputs[]` or `ui.outputs[]`

**IMPORTANT**: Cable port names must match the `port` field in each module's `ui.inputs[]` and `ui.outputs[]`. Always check the module's index.js for exact port names.

### Module Port Reference

| Module | Inputs | Outputs |
|--------|--------|---------|
| midi-cv | — | pitch, gate, velocity, mod |
| midi-4 | — | pitch1, gate1, pitch2, gate2, pitch3, gate3, pitch4, gate4 |
| midi-cc | — | cv1, cv2, cv3, cv4 |
| midi-clk | — | clock, reset, run |
| midi-drum | — | trig1, trig2, trig3, trig4, trig5, trig6, trig7, trig8, velocity |
| clk | — | clock |
| div | clock, rate1CV, rate2CV | out1, out2 |
| lfo | rateCV, waveCV, reset | primary, secondary |
| nse | — | white, pink |
| sh | in1, in2, trig1, trig2 | out1, out2 |
| quant | cv | cv, trigger |
| arp | clock, cvIn, gateIn, hold, pause | cvOut, gateOut |
| seq | clock, reset | cv, gate |
| euclid | clock, reset, lenCV, hitsCV | trig |
| logic | in1, in2 | and, or |
| mult | in1, in2 | out1a, out1b, out1c, out2a, out2b, out2c |
| vco | vOct, fm, pwm, sync | triangle, ramp, pulse |
| vcf | audio, cutoffCV, resCV | lpf, bpf, hpf |
| fold | audio, foldCV, symCV | out |
| ring | x, y | out |
| rnd | clock | step, smooth, gate |
| envf | audio | env, inv |
| func | in, trig, riseCV, fallCV, cycleCV | out, inv, eor, eoc |
| adsr | gate, retrig | env |
| vca | ch1In, ch2In, ch1CV, ch2CV | ch1Out, ch2Out |
| mix | in1, in2, in3, in4 | out |
| atten | in1, in2 | out1, out2 |
| slew | in1, cv1, in2, cv2 | out1, out2 |
| dly | inL, inR, timeCV, feedbackCV | outL, outR |
| verb | audioL, audioR, mixCV | outL, outR |
| chorus | inL, inR, rateCV, depthCV | outL, outR |
| phaser | inL, inR, rateCV, depthCV | outL, outR |
| flanger | inL, inR, rateCV, depthCV | outL, outR |
| crush | inL, inR, bitsCV, rateCV | outL, outR |
| granulita | inL, inR, hit, blendCV, pitchCV, chordCV, voiceCV, verbCV, countCV, lengthCV | outL, outR |
| db | L, R | outL, outR |
| pwm | in, pwmCV | out, inv |
| turing | clock, lockCV | cv, pulse |
| ochd | rateCV | out1, out2, out3, out4, out5, out6, out7, out8 |
| cmp2 | in1, in2, shiftCV1, sizeCV1, shiftCV2, sizeCV2 | out1, not1, out2, not2, and, or, xor, ff |
| kick | trigger, pitchCV, decayCV, toneCV | out |
| snare | trigger, toneCV, decayCV | out |
| hat | trigger, decayCV | out |
| scope | ch1, ch2 | — |
| spectrum | audio | out |
| plot | audio, trig | out |
| spectrogram | audio | out |
| out | L, R | — |

### Adding a New Patch

1. Create file: `src/js/config/patches/{name}.js`
2. Import in `src/js/config/patches/index.js`
3. Add to `FACTORY_PATCHES` export
4. Run tests: `npm test -- tests/config/factory-patches.test.js`

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

## Research

Module documentation and DSP references are maintained in `/research/`:
- `research/modules/` — Per-module specs, manuals, and implementation references
- `research/topics/` — Cross-cutting DSP topics (filters, anti-aliasing, etc.)
- `research/sound-engineering-review.md` — Sound quality improvements and recommendations

When implementing or modifying modules, consult and update the relevant research docs to maintain a trail of source material.

## Sound Engineering Philosophy

We balance hardware authenticity with optimal sound quality. When making DSP decisions:

1. **Document the options** — Record what approaches exist (e.g., linear vs allpass interpolation)
2. **Explain the trade-offs** — Note CPU cost, sound quality, complexity
3. **Reference the research** — Link to papers, code, or forum discussions that informed the choice
4. **Make the decision visible** — Comment in code why a particular approach was chosen

Before implementing improvements, check `research/sound-engineering-review.md` for prioritized recommendations. After implementing, update the review document with results and any new findings.

### Quality Priorities
1. **No audible artifacts** — Eliminate aliasing, clicks, zipper noise
2. **Musical parameter ranges** — Knobs should feel useful across their full range
3. **Analog character** — Capture warmth, nonlinearity, and behavior of hardware
4. **Modulation response** — CV inputs should respond musically at audio rates
5. **CPU efficiency** — Good enough quality at acceptable performance cost
