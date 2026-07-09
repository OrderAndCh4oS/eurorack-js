/**
 * Drums - Snare Roll
 * Fast snare roll pattern
 */
export default {
    "name": "Drums - Snare Roll",
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
                "id": "div",
                "type": "div",
                "row": 1,
                "index": 1
            },
            {
                "id": "snare",
                "type": "snare",
                "row": 1,
                "index": 2
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 1,
                "index": 3
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 4
            }
        ],
        "params": {
            "clk": {
                "rate": 0.4
            },
            "div": {
                "rate1": 0.485,
                "rate2": 0.5
            },
            "snare": {
                "snap": 0.5,
                "decay": 0.2,
                "pitch": 0.4
            },
            "mix": {
                "lvl1": 0.9,
                "lvl2": 0,
                "lvl3": 0,
                "lvl4": 0
            },
            "out": {
                "volume": 0.6
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "div",
                "toPort": "clock"
            },
            {
                "fromModule": "div",
                "fromPort": "out1",
                "toModule": "snare",
                "toPort": "trigger"
            },
            {
                "fromModule": "snare",
                "fromPort": "out",
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
