/**
 * Neon Grid
 *
 * Three-row performance patch inspired by compact live techno Eurorack rigs:
 * immediate analogue-style drums, clocked bass sequencing, generative melody,
 * and a granular/chord texture into shared space effects.
 */
export default {
    "name": "Demo - Neon Grid",
    "factory": true,
    "state": {
        "version": 2,
        "modules": [
            {
                "id": "clock",
                "type": "clk",
                "row": 1,
                "index": 0
            },
            {
                "id": "drumDiv",
                "type": "div",
                "row": 1,
                "index": 1
            },
            {
                "id": "hatEuclid",
                "type": "euclid",
                "row": 1,
                "index": 2
            },
            {
                "id": "openHatEuclid",
                "type": "euclid",
                "row": 1,
                "index": 3
            },
            {
                "id": "snareEuclid",
                "type": "euclid",
                "row": 1,
                "index": 4
            },
            {
                "id": "kick",
                "type": "kick",
                "row": 1,
                "index": 5
            },
            {
                "id": "snare",
                "type": "snare",
                "row": 1,
                "index": 6
            },
            {
                "id": "hat",
                "type": "hat",
                "row": 1,
                "index": 7
            },
            {
                "id": "drumMix",
                "type": "mix",
                "row": 1,
                "index": 8
            },
            {
                "id": "bassSeq",
                "type": "seq",
                "row": 2,
                "index": 0
            },
            {
                "id": "bassQuant",
                "type": "quant",
                "row": 2,
                "index": 1
            },
            {
                "id": "bassVco",
                "type": "vco",
                "row": 2,
                "index": 2
            },
            {
                "id": "bassFilter",
                "type": "vcf",
                "row": 2,
                "index": 3
            },
            {
                "id": "bassEnv",
                "type": "adsr",
                "row": 2,
                "index": 4
            },
            {
                "id": "bassVca",
                "type": "vca",
                "row": 2,
                "index": 5
            },
            {
                "id": "leadTuring",
                "type": "turing",
                "row": 2,
                "index": 6
            },
            {
                "id": "leadQuant",
                "type": "quant",
                "row": 2,
                "index": 7
            },
            {
                "id": "leadVco",
                "type": "vco",
                "row": 2,
                "index": 8
            },
            {
                "id": "leadFilter",
                "type": "vcf",
                "row": 2,
                "index": 9
            },
            {
                "id": "leadEnv",
                "type": "adsr",
                "row": 2,
                "index": 10
            },
            {
                "id": "leadVca",
                "type": "vca",
                "row": 2,
                "index": 11
            },
            {
                "id": "modLfo",
                "type": "lfo",
                "row": 3,
                "index": 0
            },
            {
                "id": "random",
                "type": "rnd",
                "row": 3,
                "index": 1
            },
            {
                "id": "granulita",
                "type": "granulita",
                "row": 3,
                "index": 2
            },
            {
                "id": "synthMix",
                "type": "mix",
                "row": 3,
                "index": 3
            },
            {
                "id": "chorus",
                "type": "chorus",
                "row": 3,
                "index": 4
            },
            {
                "id": "verb",
                "type": "verb",
                "row": 3,
                "index": 5
            },
            {
                "id": "delay",
                "type": "dly",
                "row": 3,
                "index": 6
            },
            {
                "id": "masterMix",
                "type": "mix",
                "row": 3,
                "index": 7
            },
            {
                "id": "out",
                "type": "out",
                "row": 3,
                "index": 8
            }
        ],
        "params": {
            "clock": {
                "rate": 0.35,
                "pause": 0
            },
            "drumDiv": {
                "rate1": 0.5,
                "rate2": 0.25
            },
            "hatEuclid": {
                "length": 16,
                "hits": 11,
                "rotate": 1
            },
            "openHatEuclid": {
                "length": 16,
                "hits": 3,
                "rotate": 5
            },
            "snareEuclid": {
                "length": 16,
                "hits": 4,
                "rotate": 4
            },
            "kick": {
                "pitch": 0.32,
                "decay": 0.48,
                "tone": 0.38,
                "click": 0.62
            },
            "snare": {
                "snap": 0.66,
                "decay": 0.34,
                "pitch": 0.48
            },
            "hat": {
                "decay": 0.2,
                "sizzle": 0.58,
                "blend": 0.42
            },
            "drumMix": {
                "lvl1": 0.4133333333333334,
                "lvl2": 0.58,
                "lvl3": 0.5866666666666667,
                "lvl4": 0
            },
            "bassSeq": {
                "step1": 0.08,
                "step2": 0.08,
                "step3": 0.25,
                "step4": 0.08,
                "step5": 0.32,
                "step6": 0.08,
                "step7": 0.22,
                "step8": 0.12,
                "length": 8,
                "range": 1,
                "direction": 0,
                "gate1": 1,
                "gate2": 0,
                "gate3": 1,
                "gate4": 1,
                "gate5": 1,
                "gate6": 0,
                "gate7": 1,
                "gate8": 1
            },
            "bassQuant": {
                "scale": 2,
                "octave": -1,
                "semitone": 0
            },
            "bassVco": {
                "coarse": 0.43,
                "fine": -0.15,
                "glide": 9
            },
            "bassFilter": {
                "cutoff": 0.46,
                "resonance": 0.28
            },
            "bassEnv": {
                "attack": 0.02,
                "decay": 0.23333333333333336,
                "sustain": 0.6,
                "release": 0.6599999999999999
            },
            "bassVca": {
                "ch1Gain": 0.9,
                "ch2Gain": 0
            },
            "leadTuring": {
                "lock": 0.84,
                "scale": 0.7200000000000001,
                "length": 5
            },
            "leadQuant": {
                "scale": 2,
                "octave": 1,
                "semitone": 0
            },
            "leadVco": {
                "coarse": 0.32999999999999985,
                "fine": 0.07,
                "glide": 2
            },
            "leadFilter": {
                "cutoff": 0.3999999999999998,
                "resonance": 0.3333333333333334
            },
            "leadEnv": {
                "attack": 0.02333333333333333,
                "decay": 0.2,
                "sustain": 0,
                "release": 0.09333333333333325
            },
            "leadVca": {
                "ch1Gain": 0.54,
                "ch2Gain": 0
            },
            "modLfo": {
                "rateKnob": 0.22,
                "waveKnob": 0.42,
                "range": 1
            },
            "random": {
                "rate": 0.42,
                "amp": 0.32
            },
            "granulita": {
                "blend": 0.56,
                "pitch": 0.21333333333333332,
                "chord": 0.42,
                "voice": 0.4,
                "verb": 0.62,
                "count": 0.4,
                "length": 0.34,
                "direction": 1,
                "hitMode": 1
            },
            "synthMix": {
                "lvl1": 0.78,
                "lvl2": 0.52,
                "lvl3": 0.44,
                "lvl4": 0
            },
            "chorus": {
                "rate": 0.2733333333333333,
                "depth": 0.58,
                "mix": 0.34
            },
            "verb": {
                "time": 0.62,
                "damp": 0.5733333333333334,
                "mix": 0.34
            },
            "delay": {
                "time": 0.36,
                "feedback": 0.42,
                "mix": 0.32
            },
            "masterMix": {
                "lvl1": 0.78,
                "lvl2": 0.56,
                "lvl3": 0.38,
                "lvl4": 0
            },
            "out": {
                "volume": 0.76
            }
        },
        "cables": [
            {
                "fromModule": "clock",
                "fromPort": "clock",
                "toModule": "drumDiv",
                "toPort": "clock"
            },
            {
                "fromModule": "clock",
                "fromPort": "clock",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "clock",
                "fromPort": "clock",
                "toModule": "hatEuclid",
                "toPort": "clock"
            },
            {
                "fromModule": "clock",
                "fromPort": "clock",
                "toModule": "openHatEuclid",
                "toPort": "clock"
            },
            {
                "fromModule": "clock",
                "fromPort": "clock",
                "toModule": "snareEuclid",
                "toPort": "clock"
            },
            {
                "fromModule": "hatEuclid",
                "fromPort": "trig",
                "toModule": "hat",
                "toPort": "trigClosed"
            },
            {
                "fromModule": "openHatEuclid",
                "fromPort": "trig",
                "toModule": "hat",
                "toPort": "trigOpen"
            },
            {
                "fromModule": "snareEuclid",
                "fromPort": "trig",
                "toModule": "snare",
                "toPort": "trigger"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "drumMix",
                "toPort": "in1"
            },
            {
                "fromModule": "snare",
                "fromPort": "out",
                "toModule": "drumMix",
                "toPort": "in2"
            },
            {
                "fromModule": "hat",
                "fromPort": "out",
                "toModule": "drumMix",
                "toPort": "in3"
            },
            {
                "fromModule": "drumDiv",
                "fromPort": "out1",
                "toModule": "bassSeq",
                "toPort": "clock"
            },
            {
                "fromModule": "bassSeq",
                "fromPort": "cv",
                "toModule": "bassQuant",
                "toPort": "cv"
            },
            {
                "fromModule": "bassQuant",
                "fromPort": "cv",
                "toModule": "bassVco",
                "toPort": "vOct"
            },
            {
                "fromModule": "bassSeq",
                "fromPort": "gate",
                "toModule": "bassEnv",
                "toPort": "gate"
            },
            {
                "fromModule": "bassVco",
                "fromPort": "pulse",
                "toModule": "bassFilter",
                "toPort": "audio"
            },
            {
                "fromModule": "bassEnv",
                "fromPort": "env",
                "toModule": "bassFilter",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "bassFilter",
                "fromPort": "lpf",
                "toModule": "bassVca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "bassEnv",
                "fromPort": "env",
                "toModule": "bassVca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "drumDiv",
                "fromPort": "out2",
                "toModule": "leadTuring",
                "toPort": "clock"
            },
            {
                "fromModule": "leadTuring",
                "fromPort": "cv",
                "toModule": "leadQuant",
                "toPort": "cv"
            },
            {
                "fromModule": "leadQuant",
                "fromPort": "cv",
                "toModule": "leadVco",
                "toPort": "vOct"
            },
            {
                "fromModule": "leadTuring",
                "fromPort": "pulse",
                "toModule": "leadEnv",
                "toPort": "gate"
            },
            {
                "fromModule": "leadVco",
                "fromPort": "triangle",
                "toModule": "leadFilter",
                "toPort": "audio"
            },
            {
                "fromModule": "leadEnv",
                "fromPort": "env",
                "toModule": "leadFilter",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "leadFilter",
                "fromPort": "lpf",
                "toModule": "leadVca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "leadEnv",
                "fromPort": "env",
                "toModule": "leadVca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "drumDiv",
                "fromPort": "out2",
                "toModule": "random",
                "toPort": "clock"
            },
            {
                "fromModule": "modLfo",
                "fromPort": "primary",
                "toModule": "bassFilter",
                "toPort": "resCV"
            },
            {
                "fromModule": "modLfo",
                "fromPort": "secondary",
                "toModule": "leadFilter",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "random",
                "fromPort": "smooth",
                "toModule": "granulita",
                "toPort": "voiceCV"
            },
            {
                "fromModule": "random",
                "fromPort": "step",
                "toModule": "granulita",
                "toPort": "pitchCV"
            },
            {
                "fromModule": "leadTuring",
                "fromPort": "pulse",
                "toModule": "granulita",
                "toPort": "hit"
            },
            {
                "fromModule": "leadFilter",
                "fromPort": "bpf",
                "toModule": "granulita",
                "toPort": "inL"
            },
            {
                "fromModule": "leadFilter",
                "fromPort": "hpf",
                "toModule": "granulita",
                "toPort": "inR"
            },
            {
                "fromModule": "bassVca",
                "fromPort": "ch1Out",
                "toModule": "synthMix",
                "toPort": "in1"
            },
            {
                "fromModule": "leadVca",
                "fromPort": "ch1Out",
                "toModule": "synthMix",
                "toPort": "in2"
            },
            {
                "fromModule": "granulita",
                "fromPort": "outL",
                "toModule": "synthMix",
                "toPort": "in3"
            },
            {
                "fromModule": "granulita",
                "fromPort": "outR",
                "toModule": "synthMix",
                "toPort": "in4"
            },
            {
                "fromModule": "synthMix",
                "fromPort": "out",
                "toModule": "chorus",
                "toPort": "inL"
            },
            {
                "fromModule": "synthMix",
                "fromPort": "out",
                "toModule": "chorus",
                "toPort": "inR"
            },
            {
                "fromModule": "chorus",
                "fromPort": "outL",
                "toModule": "verb",
                "toPort": "audioL"
            },
            {
                "fromModule": "chorus",
                "fromPort": "outR",
                "toModule": "verb",
                "toPort": "audioR"
            },
            {
                "fromModule": "verb",
                "fromPort": "outL",
                "toModule": "delay",
                "toPort": "audio"
            },
            {
                "fromModule": "drumMix",
                "fromPort": "out",
                "toModule": "masterMix",
                "toPort": "in1"
            },
            {
                "fromModule": "delay",
                "fromPort": "out",
                "toModule": "masterMix",
                "toPort": "in2"
            },
            {
                "fromModule": "verb",
                "fromPort": "outR",
                "toModule": "masterMix",
                "toPort": "in3"
            },
            {
                "fromModule": "masterMix",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "masterMix",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
