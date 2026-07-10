/**
 * Test - Hat Only
 * Isolated hi-hat test with open and closed triggers
 */
export default {
    "name": "Test - Hat Only",
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
                "id": "hat",
                "type": "hat",
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
                "rate": 0.3
            },
            "div": {
                "rate1": 0.4375,
                "rate2": 0.5
            },
            "hat": {
                "decay": 0.5,
                "sizzle": 0.5,
                "blend": 0.5
            },
            "mix": {
                "lvl1": 1,
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
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "hat",
                "toPort": "trigClosed"
            },
            {
                "fromModule": "div",
                "fromPort": "out1",
                "toModule": "hat",
                "toPort": "trigOpen"
            },
            {
                "fromModule": "hat",
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
