/**
 * Drums - Basic Beat
 * Simple kick, snare, and hi-hat pattern
 */
export default {
    "name": "Drums - Basic Beat",
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
                "id": "kick",
                "type": "kick",
                "row": 1,
                "index": 2
            },
            {
                "id": "snare",
                "type": "snare",
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
                "rate": 0.3
            },
            "div": {
                "rate1": 0.4375,
                "rate2": 0.5
            },
            "kick": {
                "pitch": 0.3,
                "decay": 0.5,
                "tone": 0.3
            },
            "snare": {
                "snap": 0.6,
                "decay": 0.4,
                "pitch": 0.5
            },
            "hat": {
                "decay": 0.3,
                "sizzle": 0.5,
                "blend": 0.4
            },
            "mix": {
                "lvl1": 0.9,
                "lvl2": 0.7,
                "lvl3": 0.5,
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
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "div",
                "fromPort": "out1",
                "toModule": "snare",
                "toPort": "trigger"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "hat",
                "toPort": "trigClosed"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "snare",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in2"
            },
            {
                "fromModule": "hat",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in3"
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
