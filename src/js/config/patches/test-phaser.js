/**
 * Test Patch: Phaser
 *
 * Tests the phaser effect on a VCO saw wave.
 * Creates sweeping notches for classic phaser sound.
 */
export default {
    "name": "Test: Phaser",
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
                "id": "phaser",
                "type": "phaser",
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
                "coarse": 0.35,
                "fine": 0
            },
            "phaser": {
                "rate": 0.3,
                "depth": 0.7,
                "feedback": 0.6,
                "mix": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "phaser",
                "toPort": "inL"
            },
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "phaser",
                "toPort": "inR"
            },
            {
                "fromModule": "phaser",
                "fromPort": "outL",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "phaser",
                "fromPort": "outR",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
