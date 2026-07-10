# eurorack-js

Browser-based Eurorack modular synthesizer emulator. Patch virtual modules together with cables to create sounds.

**[Try it live](https://orderandch4os.github.io/eurorack-js/)**

![Evolving Drone Patch](screen-grab.png)

## Modules

Built-in modules are loaded in the order listed by `src/js/rack/module-manifest.js` and grouped by each module definition's sidebar category.

### MIDI
| ID | Module | Description |
|----|--------|-------------|
| `midi-cv` | MIDI-CV | Mono MIDI-to-CV interface with pitch, gate, velocity, and mod outputs |
| `midi-4` | MIDI-4 | Four-voice polyphonic MIDI-to-CV interface |
| `midi-cc` | MIDI-CC | Four assignable MIDI CC to CV outputs |
| `midi-clk` | M-CLK | MIDI clock, reset, and run outputs |
| `midi-drum` | MIDI-DRUM | MIDI drum pads to trigger outputs plus velocity CV |

### Clock
| ID | Module | Description |
|----|--------|-------------|
| `clk` | CLK | Master clock with adjustable rate, pause control, and rate CV |
| `div` | DIV | Dual clock divider/multiplier with CV rate control |
| `swing` | SWING | Clock swing processor with straight and swung/humanized trigger outputs |
| `burst` | BURST | Pingable burst generator for ratchets, probability, and trigger clusters |

### Sources
| ID | Module | Description |
|----|--------|-------------|
| `nse` | NSE | White and pink noise generator |
| `vco` | VCO | Voltage-controlled oscillator with triangle, saw, and pulse outputs |
| `wavetable` | WAVE | Procedural wavetable oscillator with morphing, bank CV, FM, and sync |

### Voices
| ID | Module | Description |
|----|--------|-------------|
| `pluck` | PLUCK | Four-voice Karplus-Strong plucked string voice |
| `kick` | KICK | Analog-style kick drum synthesizer |
| `snare` | SNARE | Analog-style snare drum synthesizer |
| `hat` | HAT | Hi-hat synthesizer with separate open and closed triggers |

### Modulation
| ID | Module | Description |
|----|--------|-------------|
| `lfo` | LFO | Low frequency oscillator with multiple waveforms |
| `quad-lfo` | Quad LFO | Quadrature sine LFO with 0, 90, 180, and 270 degree CV outputs |
| `rnd` | RND | Random voltage generator with stepped, smooth, and gate outputs |
| `func` | FUNC | Function generator for envelopes, cycling LFOs, and slew behavior |
| `adsr` | ADSR | ADSR envelope generator with CV timing inputs |
| `ochd` | OCHD | Eight free-running triangle LFOs based on Instruo ochd |

### Sequencers
| ID | Module | Description |
|----|--------|-------------|
| `arp` | ARP | Triggered chord arpeggiator with root and chord CV |
| `seq` | SEQ | 8-step CV/gate sequencer with direction and range controls |
| `seq-switch` | SEQ-SW | Clocked sequential switch for 4-to-1 and 1-to-4 signal routing |
| `euclid` | EUCLID | Euclidean rhythm generator with length, hits, and rotation controls |
| `turing` | TURING | Random looping sequencer based on Music Thing Turing Machine |

### Quantizers
| ID | Module | Description |
|----|--------|-------------|
| `quant` | QUANT | Pitch quantizer with selectable scales and trigger output |

### Filters
| ID | Module | Description |
|----|--------|-------------|
| `vcf` | VCF | State-variable filter with low-pass, band-pass, and high-pass outputs |
| `lpg` | LPG | Vactrol-style low pass gate with VCA, combo, and low-pass modes |
| `formant` | FORMANT | Morphable vowel/formant filter with drive, shift, resonance, and CV control |

### Effects
| ID | Module | Description |
|----|--------|-------------|
| `fold` | FOLD | Wavefolder for adding harmonic complexity |
| `ring` | RING | Ring modulator for signal multiplication |
| `dly` | DLY | Mono digital delay with time, feedback, mix, and CV control |
| `tape` | TAPE | Tape-style delay with saturation, multi-head modes, wow/flutter, crinkle, tap, and freeze |
| `verb` | VERB | Stereo reverb with time, damping, mix, and mix CV |
| `chorus` | CHORUS | Stereo chorus effect |
| `phaser` | PHASER | Stereo phaser effect |
| `flanger` | FLANGER | Stereo flanger effect |
| `crush` | CRUSH | Bit crusher and sample-rate reducer |
| `loop` | LOOP | Minimal looper with record, reverse, half-speed, and clear controls |
| `granulita` | GRANULITA | Stereo granular chord processor based on Noise Engineering Granulita Versio |

### Utility
| ID | Module | Description |
|----|--------|-------------|
| `sh` | S+H | Dual sample and hold |
| `logic` | LOGIC | Boolean gate operator with AND and OR outputs |
| `mult` | MULT | Two-input, six-output signal splitter |
| `matrix` | MATRIX | 4x4 DC-coupled matrix mixer with unipolar and bipolar output modes |
| `joystick` | JOY | X/Y performance CV controller with gate, trigger, CV modes, and runtime gesture recording |
| `envf` | ENVF | Envelope follower with normal and inverted CV outputs |
| `vca` | VCA | Dual voltage-controlled amplifier |
| `atten` | ATTN | Dual attenuverter with offset controls |
| `slew` | SLEW | Dual slew limiter for portamento and CV smoothing |
| `db` | DB | Stereo VU/peak meter with audio passthrough |
| `pwm` | PWM | Pulse-width modulator with complementary outputs |
| `cmp2` | CMP2 | Dual window comparator with logic outputs based on Joranalogue Compare 2 |
| `comp` | COMP | Stereo-linked compressor/limiter with sidechain filtering and gain-reduction CV |
| `mix` | MIX | Four-channel mixer with level controls |
| `scope` | SCOPE | Dual-channel oscilloscope with scope, X-Y, and tuning modes |
| `spectrum` | SPECTRUM | Real-time FFT spectrum analyzer with audio passthrough |
| `plot` | PLOT | Waveform plotter and signal monitor with trigger input |
| `spectrogram` | SPECTRO | Scrolling spectrogram analyzer with audio passthrough |
| `rec` | REC | WAV recorder with stereo passthrough |

### Output
| ID | Module | Description |
|----|--------|-------------|
| `out` | OUT | Stereo output to speakers |

## Architecture

Self-contained module system where each module is a folder containing DSP + UI. `RackHost` owns the rack and synchronizes stable main-thread UI mirrors with production DSP instances in a required `AudioWorklet`.

See **[Codebase Architecture and Schemas](docs/architecture.md)** for the operational mental model, repository map, thread ownership, plugin loading, telemetry, routing rules, and complete schemas.

```
src/js/
├── index.js              # Public exports
├── app/                  # Browser app state/controllers
│   ├── app.js            # App bootstrap and event orchestration
│   ├── rack-host.js      # Authoritative rack/plugin/audio host
│   ├── rack-state.js     # Modules, rows, params, cables, patch state
│   └── patch-format.js   # Strict v3 patch validation
├── audio/
│   ├── graph.js          # Compiled routing graph and feedback delays
│   ├── worklet-engine.js # Main-thread AudioWorklet controller
│   └── worklet/          # Audio-thread processor and plugin registry
├── cables/
│   └── cable-manager.js  # Cable rendering & connections
├── config/
│   ├── constants.js      # System constants
│   ├── factory-patches.js # Aggregate factory patch export
│   └── patches/           # Factory patch definitions
├── modules/              # Module definitions
│   └── {moduleId}/
│       └── index.js      # DSP + UI
├── patches/              # Patch serialization
├── rack/                 # Rack infrastructure
│   ├── module-manifest.js # Module order, category taxonomy, dynamic imports
│   ├── core-definitions.js # Static core imports for the audio worklet
│   ├── module-contract.js # Port and DSP contract validation
│   └── registry.js       # Atomic trusted-plugin registry
├── ui/
│   ├── renderer.js       # Module UI generation
│   └── toolkit/          # UI components
└── utils/                # Utility functions
    ├── math.js
    ├── slew.js
    └── color.js
```

Runtime invariants:

- Production DSP runs only in the audio worklet; UI mirrors never produce sound.
- Module input and output buffers keep stable identities for their DSP lifetime.
- Inputs accept one cable. Patching an occupied input replaces its cable; outputs support fan-out.
- Feedback edges have an explicit one-block delay.
- Patch activation is revision-acknowledged and atomic.
- Trusted plugins register matching main-thread and worklet contracts.

## Creating a Module

See the **[Module Creation Guide](docs/creating-modules.md)** for detailed documentation.

This basic sine LFO is a complete, useful source module:

```javascript
// src/js/modules/basic-lfo/index.js
export default {
    id: 'basic-lfo',
    name: 'Basic LFO',
    hp: 4,
    color: 'module-color-six',
    category: 'modulation',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const sine = new Float32Array(bufferSize);
        let phase = 0;

        return {
            params: { rate: 1 },
            inputs: {},
            outputs: { sine },
            leds: { phase: 0.5 },

            process() {
                const rate = Math.max(0.05, Math.min(20, this.params.rate));
                for (let i = 0; i < bufferSize; i++) {
                    sine[i] = Math.sin(phase * Math.PI * 2) * 5;
                    phase += rate / sampleRate;
                    phase -= Math.floor(phase);
                }
                this.leds.phase = sine[bufferSize - 1] / 10 + 0.5;
            },

            reset() {
                phase = 0;
                sine.fill(0);
                this.leds.phase = 0.5;
            }
        };
    },

    ui: {
        leds: ['phase'],
        knobs: [{ id: 'rate', label: 'Rate', param: 'rate', min: 0.05, max: 20, default: 1 }],
        outputs: [{
            id: 'sine', label: 'Sine', port: 'sine', signal: 'cv',
            voltage: { min: -5, max: 5 }
        }]
    }
};
```

The `ui` declaration is the public parameter and port schema. The DSP keeps its phase private, fills the same output buffer every block, and scales the waveform to the declared ±5V range. `reset()` restores both internal state and observable outputs deterministically.

Built-in modules are registered in `src/js/rack/module-manifest.js`. External trusted modules are installed as plugins with `registerPlugin(manifest)` and must provide both their main-thread definitions and a worklet entry point. See the module creation guide for the manifest contract.

Built-ins must also be statically imported by `src/js/rack/core-definitions.js`; contract tests keep its order aligned with the manifest.

## Patch Format

Patch state is canonicalized to version 3 and declares the exact plugin patch contracts it needs:

```javascript
{
    version: 3,
    plugins: { core: 1 },
    modules: [{ id: 'vco_1', type: 'vco', row: 1, index: 0 }],
    params: { vco_1: { coarse: 0.35 } },
    cables: [{ fromModule: 'vco_1', fromPort: 'triangle', toModule: 'out_1', toPort: 'L' }],
    midiMappings: {}
}
```

Only version 3 patches are accepted. Parameters must belong to the referenced module and be declared by its UI contract; unknown modules, parameters, plugin versions, ports, and duplicate input destinations reject the patch atomically.

Every module type must belong to a declared plugin. Missing plugins, unknown ports, missing endpoints, and duplicate input destinations reject the patch atomically.

## Voltage Standards

- **Audio**: ±5V bipolar
- **Gates**: 0V (off) / 10V (on)
- **Triggers**: 5-10ms pulse at 5-10V
- **Pitch CV**: 1V/octave

## Development

```bash
npm test         # Run tests
npm run test:e2e # Run Chromium AudioWorklet smoke tests
python3 -m http.server 8000 --directory src
```

Open `http://localhost:8000`. AudioWorklet requires a supported browser and secure context; localhost qualifies for local development.

## License

MIT
