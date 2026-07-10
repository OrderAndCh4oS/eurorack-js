/**
 * Demo - Ambient Pad
 * Lush ambient pad with stereo reverb and evolving modulation.
 * Shows off the stereo spread and long decay of the reverb.
 */
export default {
    "name": "Demo - Ambient Pad",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "clk",
                "type": "clk",
                "row": 1,
                "index": 0
            },
            {
                "id": "lfo1",
                "type": "lfo",
                "row": 1,
                "index": 1
            },
            {
                "id": "lfo2",
                "type": "lfo",
                "row": 1,
                "index": 2
            },
            {
                "id": "vco1",
                "type": "vco",
                "row": 1,
                "index": 3
            },
            {
                "id": "vco2",
                "type": "vco",
                "row": 1,
                "index": 4
            },
            {
                "id": "vcf",
                "type": "vcf",
                "row": 1,
                "index": 5
            },
            {
                "id": "oscMix",
                "type": "mix",
                "row": 1,
                "index": 6
            },
            {
                "id": "adsr",
                "type": "adsr",
                "row": 2,
                "index": 6
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 2,
                "index": 7
            },
            {
                "id": "verb",
                "type": "verb",
                "row": 2,
                "index": 8
            },
            {
                "id": "out",
                "type": "out",
                "row": 2,
                "index": 9
            }
        ],
        "params": {
            "clk": {
                "rate": 0.15,
                "pause": 0
            },
            "lfo1": {
                "rate": 0.08,
                "depth": 0.4,
                "range": 0,
                "waveform": 0
            },
            "lfo2": {
                "rate": 0.12,
                "depth": 0.3,
                "range": 0,
                "waveform": 2
            },
            "vco1": {
                "coarse": 0.35,
                "fine": 0.5,
                "pw": 0.5
            },
            "vco2": {
                "coarse": 0.35,
                "fine": 0.52,
                "pw": 0.45
            },
            "oscMix": {
                "lvl1": 0.5,
                "lvl2": 0.5,
                "lvl3": 0,
                "lvl4": 0
            },
            "vcf": {
                "cutoff": 0.45,
                "resonance": 0.25
            },
            "adsr": {
                "attack": 0.6,
                "decay": 0.5,
                "sustain": 0.7,
                "release": 0.8
            },
            "vca": {
                "ch1Gain": 0,
                "ch2Gain": 0.65
            },
            "verb": {
                "time": 0.85,
                "damp": 0.35,
                "mix": 0.6
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "adsr",
                "toPort": "gate"
            },
            {
                "fromModule": "lfo1",
                "fromPort": "primary",
                "toModule": "vco1",
                "toPort": "pwm"
            },
            {
                "fromModule": "lfo2",
                "fromPort": "primary",
                "toModule": "vcf",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "lfo1",
                "fromPort": "secondary",
                "toModule": "vco2",
                "toPort": "vOct"
            },
            {
                "fromModule": "vco1",
                "fromPort": "pulse",
                "toModule": "oscMix",
                "toPort": "in1"
            },
            {
                "fromModule": "vco2",
                "fromPort": "ramp",
                "toModule": "oscMix",
                "toPort": "in2"
            },
            {
                "fromModule": "oscMix",
                "fromPort": "out",
                "toModule": "vcf",
                "toPort": "audio"
            },
            {
                "fromModule": "vcf",
                "fromPort": "lpf",
                "toModule": "vca",
                "toPort": "ch2In"
            },
            {
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vca",
                "toPort": "ch2CV"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch2Out",
                "toModule": "verb",
                "toPort": "audioL"
            },
            {
                "fromModule": "verb",
                "fromPort": "outL",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "verb",
                "fromPort": "outR",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
