/**
 * Test - Function Generator Envelope
 *
 * Demonstrates FUNC as an envelope generator:
 * - Clock triggers FUNC
 * - FUNC envelope controls VCA
 * - Adjust Rise/Fall for attack/decay
 * - Curve shapes the envelope response
 *
 * Try: Fast rise + slow fall for plucky sounds,
 * or slow rise + fast fall for reversed effects.
 */
export default {
    "name": "Test - Func Envelope",
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
                "id": "func",
                "type": "func",
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
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 3
            },
            {
                "id": "atten",
                "type": "atten",
                "row": 1,
                "index": 4
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 1,
                "index": 5
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 6
            }
        ],
        "params": {
            "clk": {
                "rate": 0.2967,
                "pause": 0
            },
            "func": {
                "rise": 0.35,
                "fall": 0.6967,
                "curve": 0.54,
                "cycle": 0
            },
            "vco": {
                "coarse": 0.35,
                "fine": 0,
                "glide": 5
            },
            "vca": {
                "ch1Gain": 1,
                "ch2Gain": 0.8
            },
            "atten": {
                "atten1": 1,
                "offset1": 0,
                "atten2": 0.5,
                "offset2": 0
            },
            "mix": {
                "lvl1": 0.8,
                "lvl2": 0.8,
                "lvl3": 0.8,
                "lvl4": 0.8
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "func",
                "toPort": "trig"
            },
            {
                "fromModule": "func",
                "fromPort": "out",
                "toModule": "atten",
                "toPort": "in1"
            },
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "vca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "atten",
                "fromPort": "out1",
                "toModule": "vca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "mix",
                "toPort": "in1"
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
