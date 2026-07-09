/**
 * Test - Ring Modulator
 *
 * Demonstrates ring modulation creating bell-like tones:
 * - Clock triggers envelope
 * - Two VCOs at different intervals through ring mod
 * - Envelope shapes amplitude for percussive bells
 *
 * Try adjusting VCO2's coarse tuning for different bell characters.
 */
export default {
    "name": "Test - Ring",
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
                "id": "vco1",
                "type": "vco",
                "row": 1,
                "index": 1
            },
            {
                "id": "vco2",
                "type": "vco",
                "row": 1,
                "index": 2
            },
            {
                "id": "ring",
                "type": "ring",
                "row": 1,
                "index": 3
            },
            {
                "id": "adsr",
                "type": "adsr",
                "row": 1,
                "index": 4
            },
            {
                "id": "vca",
                "type": "vca",
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
                "rate": 0.3,
                "pause": 0
            },
            "vco1": {
                "coarse": 0.45,
                "fine": 0,
                "glide": 5
            },
            "vco2": {
                "coarse": 0.7,
                "fine": 0,
                "glide": 5
            },
            "ring": {
                "mix": 1
            },
            "adsr": {
                "attack": 0.01,
                "decay": 0.4,
                "sustain": 0,
                "release": 0.707
            },
            "vca": {
                "ch1Gain": 0.8,
                "ch2Gain": 0.8
            },
            "out": {
                "volume": 0.6
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "adsr",
                "toPort": "gate"
            },
            {
                "fromModule": "vco1",
                "fromPort": "triangle",
                "toModule": "ring",
                "toPort": "x"
            },
            {
                "fromModule": "vco2",
                "fromPort": "triangle",
                "toModule": "ring",
                "toPort": "y"
            },
            {
                "fromModule": "ring",
                "fromPort": "out",
                "toModule": "vca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
