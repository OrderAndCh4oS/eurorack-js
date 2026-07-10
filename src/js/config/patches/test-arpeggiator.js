/**
 * Test - Arpeggiator
 * Arpeggiator module test
 */
export default {
    "name": "Test - Arpeggiator",
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
                "id": "arp",
                "type": "arp",
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
                "id": "adsr",
                "type": "adsr",
                "row": 1,
                "index": 3
            },
            {
                "id": "vca",
                "type": "vca",
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
            "clk": {
                "rate": 0.25,
                "pause": 0
            },
            "arp": {
                "root": 0,
                "chord": 1,
                "mode": 0,
                "octaves": 2
            },
            "vco": {
                "coarse": 0.35,
                "fine": 0,
                "glide": 10
            },
            "adsr": {
                "attack": 0,
                "decay": 0.22,
                "sustain": 0.4033333333333333,
                "release": 0.7333333333333333
            },
            "vca": {
                "ch1Gain": 0.8,
                "ch2Gain": 0.8
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "arp",
                "toPort": "trigger"
            },
            {
                "fromModule": "arp",
                "fromPort": "cv",
                "toModule": "vco",
                "toPort": "vOct"
            },
            {
                "fromModule": "arp",
                "fromPort": "gate",
                "toModule": "adsr",
                "toPort": "gate"
            },
            {
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "vca",
                "toPort": "ch1In"
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
