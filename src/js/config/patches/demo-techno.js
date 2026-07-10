export default {
    "name": "Demo - Techno",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "kick",
                "type": "kick",
                "row": 1,
                "index": 0
            },
            {
                "id": "clock",
                "type": "clk",
                "row": 1,
                "index": 1
            },
            {
                "id": "divider",
                "type": "div",
                "row": 1,
                "index": 2
            },
            {
                "id": "hatPattern",
                "type": "euclid",
                "row": 1,
                "index": 3
            },
            {
                "id": "hat",
                "type": "hat",
                "row": 1,
                "index": 4
            },
            {
                "id": "clap",
                "type": "snare",
                "row": 1,
                "index": 5
            },
            {
                "id": "turingBass",
                "type": "turing",
                "row": 1,
                "index": 6
            },
            {
                "id": "quantBass",
                "type": "quant",
                "row": 1,
                "index": 7
            },
            {
                "id": "vcoBass",
                "type": "vco",
                "row": 1,
                "index": 8
            },
            {
                "id": "vcfBass",
                "type": "vcf",
                "row": 1,
                "index": 9
            },
            {
                "id": "adsrBass",
                "type": "adsr",
                "row": 1,
                "index": 10
            },
            {
                "id": "vcaBass",
                "type": "vca",
                "row": 1,
                "index": 11
            },
            {
                "id": "turingLead",
                "type": "turing",
                "row": 1,
                "index": 12
            },
            {
                "id": "quantLead",
                "type": "quant",
                "row": 1,
                "index": 13
            },
            {
                "id": "vcoLead",
                "type": "vco",
                "row": 1,
                "index": 14
            },
            {
                "id": "vcfLead",
                "type": "vcf",
                "row": 1,
                "index": 15
            },
            {
                "id": "adsrLead",
                "type": "adsr",
                "row": 1,
                "index": 16
            },
            {
                "id": "vcaLead",
                "type": "vca",
                "row": 1,
                "index": 17
            },
            {
                "id": "output",
                "type": "out",
                "row": 1,
                "index": 18
            },
            {
                "id": "lfoFilter",
                "type": "lfo",
                "row": 2,
                "index": 0
            },
            {
                "id": "drumMix",
                "type": "mix",
                "row": 2,
                "index": 1
            },
            {
                "id": "synthMix",
                "type": "mix",
                "row": 2,
                "index": 2
            },
            {
                "id": "delay",
                "type": "dly",
                "row": 2,
                "index": 3
            },
            {
                "id": "reverb",
                "type": "verb",
                "row": 2,
                "index": 4
            },
            {
                "id": "masterMix",
                "type": "mix",
                "row": 2,
                "index": 5
            }
        ],
        "params": {
            "clock": {
                "rate": 0.35,
                "pause": 0
            },
            "divider": {
                "rate1": 0.5,
                "rate2": 0.25
            },
            "hatPattern": {
                "length": 16,
                "hits": 8,
                "rotate": 1
            },
            "kick": {
                "pitch": 0.12999999999999992,
                "decay": 0.12333333333333335,
                "tone": 0.4933333333333333,
                "click": 0.6333333333333333
            },
            "hat": {
                "decay": 0,
                "sizzle": 0.38,
                "blend": 0.5
            },
            "clap": {
                "snap": 0.45333333333333325,
                "decay": 0.03666666666666665,
                "pitch": 0.11666666666666664
            },
            "turingBass": {
                "lock": 0.9,
                "scale": 0.15,
                "length": 4
            },
            "quantBass": {
                "scale": 2,
                "octave": -1,
                "semitone": 0
            },
            "vcoBass": {
                "coarse": 0.5900333333333332,
                "fine": -0.08,
                "glide": 12
            },
            "vcfBass": {
                "cutoff": 0.6433666666666668,
                "resonance": 0.72
            },
            "adsrBass": {
                "attack": 0,
                "decay": 0.1533,
                "sustain": 0.18,
                "release": 0.6666666666666667
            },
            "vcaBass": {
                "ch1Gain": 0.8,
                "ch2Gain": 0.5
            },
            "turingLead": {
                "lock": 0.85,
                "scale": 0.25,
                "length": 6
            },
            "quantLead": {
                "scale": 2,
                "octave": 0,
                "semitone": 0
            },
            "vcoLead": {
                "coarse": 0.25663333333333327,
                "fine": 0,
                "glide": 0
            },
            "vcfLead": {
                "cutoff": 0.5667,
                "resonance": 0.6467
            },
            "adsrLead": {
                "attack": 0.05,
                "decay": 0.2,
                "sustain": 0.1,
                "release": 0.5900333333333334
            },
            "vcaLead": {
                "ch1Gain": 0.5466666666666666,
                "ch2Gain": 0.5
            },
            "output": {
                "volume": 0.8
            },
            "lfoFilter": {
                "rateKnob": 0.4,
                "waveKnob": 0.5,
                "range": 0
            },
            "drumMix": {
                "lvl1": 0.47333333333333333,
                "lvl2": 0.3,
                "lvl3": 0.2266333333333333,
                "lvl4": 0
            },
            "synthMix": {
                "lvl1": 0.7799666666666667,
                "lvl2": 0.7266333333333334,
                "lvl3": 0,
                "lvl4": 0
            },
            "delay": {
                "time": 0.3333,
                "feedback": 0.0367,
                "mix": 0.3933
            },
            "reverb": {
                "time": 0.3267,
                "damp": 0.46,
                "mix": 0.37
            },
            "masterMix": {
                "lvl1": 0.6867,
                "lvl2": 0.7133,
                "lvl3": 0,
                "lvl4": 0
            }
        },
        "cables": [
            {
                "fromModule": "clock",
                "fromPort": "clock",
                "toModule": "divider",
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
                "toModule": "hatPattern",
                "toPort": "clock"
            },
            {
                "fromModule": "divider",
                "fromPort": "out1",
                "toModule": "clap",
                "toPort": "trigger"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "drumMix",
                "toPort": "in1"
            },
            {
                "fromModule": "hat",
                "fromPort": "out",
                "toModule": "drumMix",
                "toPort": "in2"
            },
            {
                "fromModule": "clap",
                "fromPort": "out",
                "toModule": "drumMix",
                "toPort": "in3"
            },
            {
                "fromModule": "clock",
                "fromPort": "clock",
                "toModule": "turingBass",
                "toPort": "clock"
            },
            {
                "fromModule": "turingBass",
                "fromPort": "cv",
                "toModule": "quantBass",
                "toPort": "cv"
            },
            {
                "fromModule": "quantBass",
                "fromPort": "cv",
                "toModule": "vcoBass",
                "toPort": "vOct"
            },
            {
                "fromModule": "turingBass",
                "fromPort": "pulse",
                "toModule": "adsrBass",
                "toPort": "gate"
            },
            {
                "fromModule": "vcoBass",
                "fromPort": "pulse",
                "toModule": "vcfBass",
                "toPort": "audio"
            },
            {
                "fromModule": "vcfBass",
                "fromPort": "lpf",
                "toModule": "vcaBass",
                "toPort": "ch1In"
            },
            {
                "fromModule": "adsrBass",
                "fromPort": "env",
                "toModule": "vcaBass",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "lfoFilter",
                "fromPort": "primary",
                "toModule": "vcfBass",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "divider",
                "fromPort": "out1",
                "toModule": "turingLead",
                "toPort": "clock"
            },
            {
                "fromModule": "turingLead",
                "fromPort": "cv",
                "toModule": "quantLead",
                "toPort": "cv"
            },
            {
                "fromModule": "quantLead",
                "fromPort": "cv",
                "toModule": "vcoLead",
                "toPort": "vOct"
            },
            {
                "fromModule": "turingLead",
                "fromPort": "pulse",
                "toModule": "adsrLead",
                "toPort": "gate"
            },
            {
                "fromModule": "vcoLead",
                "fromPort": "ramp",
                "toModule": "vcfLead",
                "toPort": "audio"
            },
            {
                "fromModule": "vcfLead",
                "fromPort": "lpf",
                "toModule": "vcaLead",
                "toPort": "ch1In"
            },
            {
                "fromModule": "adsrLead",
                "fromPort": "env",
                "toModule": "vcaLead",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "adsrLead",
                "fromPort": "env",
                "toModule": "vcfLead",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "vcaBass",
                "fromPort": "ch1Out",
                "toModule": "synthMix",
                "toPort": "in1"
            },
            {
                "fromModule": "vcaLead",
                "fromPort": "ch1Out",
                "toModule": "synthMix",
                "toPort": "in2"
            },
            {
                "fromModule": "synthMix",
                "fromPort": "out",
                "toModule": "delay",
                "toPort": "audio"
            },
            {
                "fromModule": "delay",
                "fromPort": "out",
                "toModule": "reverb",
                "toPort": "audioL"
            },
            {
                "fromModule": "delay",
                "fromPort": "out",
                "toModule": "reverb",
                "toPort": "audioR"
            },
            {
                "fromModule": "drumMix",
                "fromPort": "out",
                "toModule": "masterMix",
                "toPort": "in1"
            },
            {
                "fromModule": "reverb",
                "fromPort": "outL",
                "toModule": "masterMix",
                "toPort": "in2"
            },
            {
                "fromModule": "masterMix",
                "fromPort": "out",
                "toModule": "output",
                "toPort": "L"
            },
            {
                "fromModule": "masterMix",
                "fromPort": "out",
                "toModule": "output",
                "toPort": "R"
            },
            {
                "fromModule": "hatPattern",
                "fromPort": "trig",
                "toModule": "hat",
                "toPort": "trigClosed"
            }
        ],
        "midiMappings": {}
    }
};
