/**
 * Test - Pluck
 * Clocked four-voice plucked string patch with sequenced 1V/oct pitch.
 */
export default {
    "name": "Test - Pluck",
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
                "id": "seq",
                "type": "seq",
                "row": 1,
                "index": 1
            },
            {
                "id": "pluck",
                "type": "pluck",
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
                "rate": 0.28
            },
            "seq": {
                "step1": 0,
                "step2": 0.2,
                "step3": 0.45,
                "step4": 0.7,
                "step5": 0.9,
                "step6": 0.7,
                "step7": 0.45,
                "step8": 0.2,
                "gate1": 1,
                "gate2": 1,
                "gate3": 1,
                "gate4": 1,
                "gate5": 1,
                "gate6": 1,
                "gate7": 1,
                "gate8": 1,
                "range": 1,
                "length": 8,
                "direction": 0
            },
            "pluck": {
                "pitch": 0.34,
                "decay": 0.72,
                "damp": 0.74,
                "position": 0.38
            },
            "out": {
                "volume": 0.7
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
                "toModule": "pluck",
                "toPort": "trigger"
            },
            {
                "fromModule": "seq",
                "fromPort": "cv",
                "toModule": "pluck",
                "toPort": "vOct"
            },
            {
                "fromModule": "pluck",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "pluck",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
