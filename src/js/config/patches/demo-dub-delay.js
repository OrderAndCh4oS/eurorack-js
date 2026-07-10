/**
 * Demo - Dub Delay
 * Classic dub-style delay with tempo-synced echoes.
 * Features rich feedback, filter envelope sweep, and spacious mixing.
 */
export default {
    "name": "Demo - Dub Delay",
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
                "id": "div",
                "type": "div",
                "row": 1,
                "index": 1
            },
            {
                "id": "seq",
                "type": "seq",
                "row": 1,
                "index": 2
            },
            {
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 3
            },
            {
                "id": "vcf",
                "type": "vcf",
                "row": 1,
                "index": 4
            },
            {
                "id": "adsr",
                "type": "adsr",
                "row": 1,
                "index": 5
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 6
            },
            {
                "id": "dly",
                "type": "dly",
                "row": 1,
                "index": 7
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 1,
                "index": 8
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 9
            }
        ],
        "params": {
            "clk": {
                "rate": 0.31,
                "pause": 0
            },
            "div": {
                "rate1": 0.5,
                "rate2": 0.5
            },
            "seq": {
                "step1": 0.2,
                "step2": 0.4,
                "step3": 0.3,
                "step4": 0.5,
                "step5": 0.2,
                "step6": 0.6,
                "step7": 0.4,
                "step8": 0.3,
                "length": 8,
                "range": 1,
                "direction": 0,
                "gate1": 1,
                "gate2": 1,
                "gate3": 0,
                "gate4": 1,
                "gate5": 1,
                "gate6": 0,
                "gate7": 1,
                "gate8": 0
            },
            "vco": {
                "coarse": 0.3,
                "fine": 0.5,
                "glide": 0.15
            },
            "vcf": {
                "cutoff": 0.55,
                "resonance": 0.35
            },
            "adsr": {
                "attack": 0.02,
                "decay": 0.5566666666666666,
                "sustain": 0.3,
                "release": 0.61
            },
            "vca": {
                "ch1Gain": 0,
                "ch2Gain": 0.75
            },
            "dly": {
                "time": 0.29033333333333333,
                "feedback": 0.3466666666666666,
                "mix": 0.5733333333333334
            },
            "mix": {
                "lvl1": 0.6,
                "lvl2": 0.7,
                "lvl3": 0,
                "lvl4": 0
            },
            "out": {
                "volume": 0.55
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "seq",
                "toPort": "clock"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "div",
                "toPort": "clock"
            },
            {
                "fromModule": "seq",
                "fromPort": "cv",
                "toModule": "vco",
                "toPort": "vOct"
            },
            {
                "fromModule": "seq",
                "fromPort": "gate",
                "toModule": "adsr",
                "toPort": "gate"
            },
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "vcf",
                "toPort": "audio"
            },
            {
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vcf",
                "toPort": "cutoffCV"
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
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch2Out",
                "toModule": "dly",
                "toPort": "audio"
            },
            {
                "fromModule": "dly",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in2"
            },
            {
                "fromModule": "mix",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "mix",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
