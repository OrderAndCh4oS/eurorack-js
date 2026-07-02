# eurorack-js

Browser-based Eurorack modular synthesizer emulator. Patch virtual modules together with cables to create sounds.

**[Try it live](https://orderandch4os.github.io/eurorack-js/)**

![Evolving Drone Patch](screen-grab.png)

## Modules

### Sources
| Module | Description |
|--------|-------------|
| CLK | Master clock with adjustable BPM |
| VCO | Voltage-controlled oscillator (triangle, saw, pulse) |
| LFO | Low frequency oscillator with multiple waveforms |
| NSE | White/pink noise generator |
| ØCHD | 8x free-running triangle LFOs (based on Instruo øchd) |

### Modulators
| Module | Description |
|--------|-------------|
| DIV | Clock divider/multiplier (÷16 to x16) |
| S+H | Dual sample & hold |
| QUANT | Pitch quantizer with selectable scales |
| ARP | Arpeggiator with chord patterns |
| SEQ | 8-step CV/gate sequencer with direction modes |
| EUCLID | Euclidean rhythm generator (evenly distributed triggers) |
| TURING | Turing Machine - random looping sequencer (based on Music Thing) |
| LOGIC | Boolean gate operator (AND/OR) |
| MULT | 2-in, 6-out signal splitter |
| RND | Random voltage generator (stepped/smooth outputs) |
| ENVF | Envelope follower (audio to CV) |
| FUNC | Function generator - AR envelope, LFO, slew (based on Make Noise Maths/Function) |
| ADSR | Envelope generator |
| CMP2 | Dual window comparator with logic (based on Joranalogue Compare 2) |

### Processors
| Module | Description |
|--------|-------------|
| VCF | State-variable filter (LP, BP, HP) |
| FOLD | Wavefolder for harmonic complexity |
| RING | Ring modulator (signal multiplication) |
| VCA | Dual voltage-controlled amplifier |
| MIX | 4-channel mixer with level controls |
| DLY | Stereo delay with time, feedback, mix |
| VERB | Stereo reverb with size, damping, mix |
| CHORUS | Stereo chorus effect |
| PHASER | Stereo phaser effect |
| FLANGER | Stereo flanger effect |
| CRUSH | Bit crusher / sample rate reducer |
| LOOP | Minimal looper with four record modes (based on 2hp Loop) |
| PWM | Pulse width modulator with complementary outputs |

### Drums
| Module | Description |
|--------|-------------|
| KICK | Analog-style kick drum synthesizer |
| SNARE | Analog-style snare drum synthesizer |
| HAT | Analog-style hi-hat synthesizer |

### Utility
| Module | Description |
|--------|-------------|
| ATTN | Dual attenuverter with offset (scale, invert, shift CV) |
| SLEW | Dual slew limiter (portamento, CV smoothing) |
| DB | Stereo VU meter with dB readout |
| SCOPE | Dual-channel oscilloscope (Scope, X-Y, Tune modes) |
| SPECTRUM | Real-time FFT spectrum analyzer |
| PLOT | Waveform plotter / signal monitor |
| SPECTRO | Scrolling spectrogram analyzer |
| REC | WAV recorder |
| OUT | Stereo output to speakers |

## Architecture

Self-contained module system where each module is a folder containing DSP + UI. The browser app is a thin HTML shell backed by a state-driven app layer:

```
src/js/
├── index.js              # Public exports
├── app/                  # Browser app state/controllers
│   ├── app.js            # App bootstrap and event orchestration
│   ├── rack-state.js     # Modules, rows, params, cables, patch state
│   └── patch-format.js   # v2 patch normalization/migration
├── audio/
│   └── engine.js         # DSP processing loop
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
│   ├── module-manifest.js # Module order, category labels, dynamic imports
│   ├── rack.js           # Legacy/simple rack helper
│   └── registry.js       # Module lookup/validation
├── ui/
│   ├── renderer.js       # Module UI generation
│   └── toolkit/          # UI components
└── utils/                # Utility functions
    ├── math.js
    ├── slew.js
    └── color.js
```

## Creating a Module

See the **[Module Creation Guide](docs/creating-modules.md)** for detailed documentation.

Quick example:

```javascript
// src/js/modules/mymodule/index.js
export default {
    id: 'mymodule',
    name: 'My Module',
    hp: 4,
    color: 'module-color-six',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        return {
            params: { gain: 0.5 },
            inputs: { audio: new Float32Array(bufferSize) },
            outputs: { out },
            leds: {},
            process() {
                for (let i = 0; i < bufferSize; i++) {
                    out[i] = this.inputs.audio[i] * this.params.gain;
                }
            }
        };
    },

    ui: {
        knobs: [{ id: 'gain', label: 'Gain', param: 'gain', min: 0, max: 1, default: 0.5 }],
        inputs: [{ id: 'audio', label: 'In', port: 'audio', type: 'audio' }],
        outputs: [{ id: 'out', label: 'Out', port: 'out', type: 'audio' }]
    }
};
```

Register new modules in `src/js/rack/module-manifest.js`; the registry and default processing order are derived from that manifest.

## Patch Format

Patch state is canonicalized to version 2:

```javascript
{
    version: 2,
    modules: [{ id: 'vco_1', type: 'vco', row: 1, index: 0 }],
    params: { vco_1: { coarse: 0.35 } },
    cables: [{ fromModule: 'vco_1', fromPort: 'triangle', toModule: 'out_1', toPort: 'L' }],
    midiMappings: {}
}
```

Older factory/user patches with `knobs`, `switches`, `buttons`, and `instanceId` are normalized through `src/js/app/patch-format.js`.

## Voltage Standards

- **Audio**: ±5V bipolar
- **Gates**: 0V (off) / 10V (on)
- **Triggers**: 5-10ms pulse at 5-10V
- **Pitch CV**: 1V/octave

## Development

```bash
npm test         # Run tests
```

## License

MIT
