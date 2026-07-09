/**
 * Test - Loop
 * Record-ready VCO patch for the 2hp-style looper.
 */
export default {
    "name": "Test - Loop",
    "factory": true,
    "state": {
        "version": 2,
        "modules": [
            {
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 0
            },
            {
                "id": "loop",
                "type": "loop",
                "row": 1,
                "index": 1
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 2
            }
        ],
        "params": {
            "vco": {
                "coarse": 0.32,
                "fine": 0.5,
                "glide": 0
            },
            "loop": {
                "length": 1,
                "mix": 1,
                "level": 0.8,
                "record": 0,
                "reverse": 0,
                "halfSpeed": 0,
                "clear": 0,
                "mode": 0
            },
            "out": {
                "volume": 0.55
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "loop",
                "toPort": "in"
            },
            {
                "fromModule": "loop",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "loop",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
