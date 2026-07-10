/**
 * Test - Mult
 *
 * Demonstrates signal splitting:
 * - One LFO split to modulate two VCOs at different rates
 * - Creates a detuned/chorusing effect
 */
export default {
    "name": "Test - Mult",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "lfo",
                "type": "lfo",
                "row": 1,
                "index": 0
            },
            {
                "id": "mult",
                "type": "mult",
                "row": 1,
                "index": 1
            },
            {
                "id": "vco1",
                "type": "vco",
                "row": 1,
                "index": 2
            },
            {
                "id": "vco2",
                "type": "vco",
                "row": 1,
                "index": 3
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 1,
                "index": 4
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 5
            }
        ],
        "params": {
            "lfo": {
                "rate": 0.3,
                "shape": 0.5,
                "range": 0
            },
            "vco1": {
                "coarse": 0.4,
                "fine": 0
            },
            "vco2": {
                "coarse": 0.4,
                "fine": 0.1
            },
            "mix": {
                "lvl1": 0.6,
                "lvl2": 0.6
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "mult",
                "toPort": "in1"
            },
            {
                "fromModule": "mult",
                "fromPort": "out1a",
                "toModule": "vco1",
                "toPort": "vOct"
            },
            {
                "fromModule": "mult",
                "fromPort": "out1b",
                "toModule": "vco2",
                "toPort": "vOct"
            },
            {
                "fromModule": "vco1",
                "fromPort": "ramp",
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "vco2",
                "fromPort": "ramp",
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
