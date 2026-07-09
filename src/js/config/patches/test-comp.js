/**
 * Test - COMP
 *
 * Stereo VCO signal through COMP with a clocked kick driving the sidechain.
 * The scope shows detector envelope and gain reduction CV.
 */
export default {
    "name": "Test - COMP",
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
                "id": "kick",
                "type": "kick",
                "row": 1,
                "index": 1
            },
            {
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 2
            },
            {
                "id": "comp",
                "type": "comp",
                "row": 1,
                "index": 3
            },
            {
                "id": "scope",
                "type": "scope",
                "row": 2,
                "index": 0
            },
            {
                "id": "out",
                "type": "out",
                "row": 2,
                "index": 1
            }
        ],
        "params": {
            "clk": {
                "rate": 0.29,
                "pause": 0
            },
            "kick": {
                "pitch": 0.28,
                "decay": 0.42,
                "tone": 0.44,
                "click": 0.6
            },
            "vco": {
                "coarse": 0.32,
                "fine": -0.03,
                "glide": 4
            },
            "comp": {
                "threshold": 0.52,
                "ratio": 0.78,
                "attack": 0.28,
                "release": 0.47,
                "makeup": 0.43,
                "sideFilter": 0.31,
                "mix": 1,
                "mode": 0,
                "detector": 1,
                "filterMode": 0,
                "bypass": 0
            },
            "scope": {
                "time": 0.34,
                "gain1": 0.5,
                "gain2": 0.5,
                "offset1": 0.5,
                "offset2": 0.5,
                "trigger": 0.52,
                "mode": 0
            },
            "out": {
                "volume": 0.55
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "comp",
                "toPort": "inL"
            },
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "comp",
                "toPort": "inR"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "comp",
                "toPort": "sidechain"
            },
            {
                "fromModule": "comp",
                "fromPort": "env",
                "toModule": "scope",
                "toPort": "in1"
            },
            {
                "fromModule": "comp",
                "fromPort": "gr",
                "toModule": "scope",
                "toPort": "in2"
            },
            {
                "fromModule": "comp",
                "fromPort": "outL",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "comp",
                "fromPort": "outR",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
