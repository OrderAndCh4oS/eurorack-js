/**
 * Demo - Drum and Bass
 * Fast breakbeat-style drums with synced arpeggiator bass line
 */
export default {
    "name": "Demo - Drum and Bass",
    "factory": true,
    "state": {
        "version": 2,
        "modules": [
            {
                "id": "clk",
                "type": "clk",
                "row": 1,
                "index": 0
            },
            {
                "id": "div1",
                "type": "div",
                "row": 1,
                "index": 1
            },
            {
                "id": "div2",
                "type": "div",
                "row": 1,
                "index": 2
            },
            {
                "id": "kick",
                "type": "kick",
                "row": 1,
                "index": 3
            },
            {
                "id": "snare",
                "type": "snare",
                "row": 1,
                "index": 4
            },
            {
                "id": "hat",
                "type": "hat",
                "row": 1,
                "index": 5
            },
            {
                "id": "arp",
                "type": "arp",
                "row": 1,
                "index": 6
            },
            {
                "id": "quant",
                "type": "quant",
                "row": 1,
                "index": 7
            },
            {
                "id": "bass",
                "type": "vco",
                "row": 1,
                "index": 8
            },
            {
                "id": "vcf",
                "type": "vcf",
                "row": 1,
                "index": 9
            },
            {
                "id": "bassEnv",
                "type": "adsr",
                "row": 1,
                "index": 10
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 11
            },
            {
                "id": "drums",
                "type": "mix",
                "row": 1,
                "index": 12
            },
            {
                "id": "master",
                "type": "mix",
                "row": 1,
                "index": 13
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 14
            },
            {
                "id": "div3",
                "type": "div",
                "row": 1,
                "index": 15
            }
        ],
        "params": {
            "clk": {
                "rate": 0.38666666666666666,
                "pause": 0
            },
            "div1": {
                "rate1": 0.2933333333333332,
                "rate2": 0.3983333333333333
            },
            "div2": {
                "rate1": 0.5333333333333332,
                "rate2": 0.5866666666666668
            },
            "kick": {
                "pitch": 0.35666666666666663,
                "decay": 0.66,
                "tone": 0.5933333333333333,
                "click": 0.6799999999999999
            },
            "snare": {
                "snap": 0.3933333333333333,
                "decay": 0,
                "pitch": 0.3966666666666667
            },
            "hat": {
                "decay": 0.07333333333333336,
                "sizzle": 0.6666666666666666,
                "blend": 1
            },
            "arp": {
                "root": 6,
                "chord": 5,
                "mode": 2,
                "octaves": 1
            },
            "quant": {
                "scale": 2,
                "octave": -1,
                "semitone": 0
            },
            "bass": {
                "coarse": 0.3033333333333334,
                "fine": 0.96,
                "glide": 0.6666666666666661
            },
            "vcf": {
                "cutoff": 0.6533333333333334,
                "resonance": 0.7333333333333333
            },
            "bassEnv": {
                "attack": 0,
                "decay": 0.5866666666666667,
                "sustain": 0.45666666666666667,
                "release": 0.6866666666666665
            },
            "vca": {
                "ch1Gain": 0.9,
                "ch2Gain": 0.9
            },
            "drums": {
                "lvl1": 0.22,
                "lvl2": 0.2733333333333333,
                "lvl3": 0.18,
                "lvl4": 0
            },
            "master": {
                "lvl1": 0.23333333333333334,
                "lvl2": 0.28,
                "lvl3": 0,
                "lvl4": 0
            },
            "out": {
                "volume": 0.7
            },
            "div3": {
                "rate1": 0.44999999999999996,
                "rate2": 0.21999999999999997
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "div1",
                "toPort": "clock"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "div2",
                "toPort": "clock"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "div3",
                "toPort": "clock"
            },
            {
                "fromModule": "div1",
                "fromPort": "out1",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "div1",
                "fromPort": "out2",
                "toModule": "snare",
                "toPort": "trigger"
            },
            {
                "fromModule": "div2",
                "fromPort": "out1",
                "toModule": "hat",
                "toPort": "trigClosed"
            },
            {
                "fromModule": "div2",
                "fromPort": "out2",
                "toModule": "hat",
                "toPort": "trigOpen"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "drums",
                "toPort": "in1"
            },
            {
                "fromModule": "snare",
                "fromPort": "out",
                "toModule": "drums",
                "toPort": "in2"
            },
            {
                "fromModule": "hat",
                "fromPort": "out",
                "toModule": "drums",
                "toPort": "in3"
            },
            {
                "fromModule": "div3",
                "fromPort": "out1",
                "toModule": "arp",
                "toPort": "trigger"
            },
            {
                "fromModule": "arp",
                "fromPort": "cv",
                "toModule": "quant",
                "toPort": "cv"
            },
            {
                "fromModule": "arp",
                "fromPort": "gate",
                "toModule": "bassEnv",
                "toPort": "gate"
            },
            {
                "fromModule": "quant",
                "fromPort": "cv",
                "toModule": "bass",
                "toPort": "vOct"
            },
            {
                "fromModule": "bass",
                "fromPort": "ramp",
                "toModule": "vcf",
                "toPort": "audio"
            },
            {
                "fromModule": "vcf",
                "fromPort": "lpf",
                "toModule": "vca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "bassEnv",
                "fromPort": "env",
                "toModule": "vca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "drums",
                "fromPort": "out",
                "toModule": "master",
                "toPort": "in1"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "master",
                "toPort": "in2"
            },
            {
                "fromModule": "master",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "master",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
