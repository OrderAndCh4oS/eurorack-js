/**
 * Test - Snare Only
 * Isolated snare drum test
 */
export default {
    "name": "Test - Snare Only",
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
                "id": "snare",
                "type": "snare",
                "row": 1,
                "index": 1
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 1,
                "index": 2
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 3
            }
        ],
        "params": {
            "clk": {
                "rate": 0.25
            },
            "snare": {
                "snap": 0.5,
                "decay": 0.5,
                "pitch": 0.5
            },
            "mix": {
                "lvl1": 1,
                "lvl2": 0,
                "lvl3": 0,
                "lvl4": 0
            },
            "out": {
                "volume": 0.7
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
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
