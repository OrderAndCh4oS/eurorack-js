# Eurorack Emulator Research

Knowledge bank of hardware specifications, DSP implementation references, and academic resources for module development.

## Sound Engineering Review

**[sound-engineering-review.md](sound-engineering-review.md)** — Systematic analysis of each module against best practices, with prioritized improvement recommendations.

### High Priority Improvements
1. VCF per-sample CV tracking (enables audio-rate filter modulation)
2. Kick click transient (punchier drums)
3. Kick pitch sweep control (more versatile)
4. VCF resonance compensation (consistent mixing levels)
5. ADSR CV inputs (essential for expressive patches)
6. Verb early reflections (more natural reverb)

See the full review for complete analysis and implementation guidance.

---

## Module Documentation

Each module has a dedicated research file documenting hardware specs, DSP algorithms, and implementation references.

### Sources
| Module | Description | Status |
|--------|-------------|--------|
| [clk](modules/clk.md) | Clock Generator | ✅ Complete |
| [lfo](modules/lfo.md) | Low Frequency Oscillator | ✅ Complete |
| [nse](modules/nse.md) | Noise Generator | ✅ Complete |
| [vco](modules/vco.md) | Voltage Controlled Oscillator | ✅ Complete |

### Modulators
| Module | Description | Status |
|--------|-------------|--------|
| [div](modules/div.md) | Clock Divider | ✅ Complete |
| [sh](modules/sh.md) | Sample & Hold | ✅ Complete |
| [quant](modules/quant.md) | Quantizer | ✅ Complete |
| [adsr](modules/adsr.md) | Envelope Generator | ✅ Complete |

### Sequencing
| Module | Description | Status |
|--------|-------------|--------|
| [arp](modules/arp.md) | Arpeggiator | ✅ Complete |
| [seq](modules/seq.md) | Step Sequencer | ✅ Complete |

### Processing
| Module | Description | Status |
|--------|-------------|--------|
| [vcf](modules/vcf.md) | Voltage Controlled Filter | ✅ Complete |
| [vca](modules/vca.md) | Voltage Controlled Amplifier | ✅ Complete |
| [mix](modules/mix.md) | Mixer | ✅ Complete |
| [scope](modules/scope.md) | Oscilloscope | ✅ Complete |

### Effects
| Module | Description | Status |
|--------|-------------|--------|
| [dly](modules/dly.md) | Digital Delay | ✅ Complete |
| [verb](modules/verb.md) | Reverb | ✅ Complete |

### Drums
| Module | Description | Status |
|--------|-------------|--------|
| [kick](modules/kick.md) | Kick Drum | ✅ Complete |
| [snare](modules/snare.md) | Snare Drum | ✅ Complete |
| [hat](modules/hat.md) | Hi-Hat | ✅ Complete |

### Output
| Module | Description | Status |
|--------|-------------|--------|
| [out](modules/out.md) | Output Module | ✅ Complete |

## Topic Guides

Cross-cutting DSP topics and techniques.

| Topic | Description |
|-------|-------------|
| [Anti-Aliasing](topics/anti-aliasing.md) | PolyBLEP, oversampling, band-limiting |
| [Filters](topics/filters.md) | SVF, ladder, biquad topologies |
| [Oscillators](topics/oscillators.md) | Waveform generation techniques |
| [Effects](topics/effects.md) | Delay lines, reverb algorithms |

## Key Reference Sources

### Manufacturer Documentation
- [2hp Modules](https://www.twohp.com/modules) — Official manuals for 2hp modules
- [ModularGrid](https://modulargrid.net) — Eurorack module database with specs
- [Intellijel](https://intellijel.com/) — Zeroscope reference
- [Doepfer](https://www.doepfer.de/) — Classic module designs

### Open Source DSP
- [Mutable Instruments GitHub](https://github.com/pichenettes/eurorack) — Émilie Gillet's open source module code
- [Synthesis Toolkit (STK)](https://ccrma.stanford.edu/software/stk/) — Perry Cook's C++ DSP library
- [MoogLadders](https://github.com/ddiakopoulos/MoogLadders) — Filter implementations
- [Freeverb3](https://freeverb3-vst.sourceforge.io/) — Reverb algorithms

### Academic Resources
- [CCRMA Physical Audio Signal Processing](https://ccrma.stanford.edu/~jos/pasp/) — Julius O. Smith's textbook (free)
- [DAFX Book](https://www.dafx.de/) — Digital Audio Effects textbook
- [MusicDSP.org](https://www.musicdsp.org/) — Community code snippets archive
- [DAFx Paper Archive](https://dafx.de/paper-archive/) — Conference papers

### Key Papers
- [Välimäki & Huovilainen: Antialiasing Oscillators](https://ieeexplore.ieee.org/document/4117934)
- [Huovilainen: Non-Linear Moog Filter](https://dafx.de/paper-archive/2004/P_061.PDF)
- [Zavalishin: The Art of VA Filter Design](https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.0.pdf)
- [Dattorro: Effect Design Part 1 & 2](https://ccrma.stanford.edu/~dattorro/)

### Community Forums
- [KVR Audio DSP Forum](https://www.kvraudio.com/forum/viewforum.php?f=33)
- [DSP Stack Exchange](https://dsp.stackexchange.com/)

## Document Template

When adding new module documentation, use this template:

```markdown
# {Module Name} ({ID})

## Hardware Reference
- **Based on**: [Manufacturer Module Name](link)
- **Manual**: [PDF link]
- **ModularGrid**: [link]

## Specifications
- Knobs: list with ranges
- CV Inputs: voltage ranges
- Outputs: signal types
- Special modes/features

## DSP Implementation

### Algorithm Overview
Brief description of the DSP approach

### Key References
- [Paper/Book Title](link) - Brief description

### Code Notes
Implementation details specific to our version

## Potential Improvements
- Feature ideas for future development

## Sources
- [Source 1](url)
```
