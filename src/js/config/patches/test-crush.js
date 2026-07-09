/**
 * Test Patch: Bitcrusher
 *
 * Tests the bitcrusher effect on a VCO saw wave.
 * Creates lo-fi digital distortion and aliasing artifacts.
 */
export default {
    "name": "Test: Bitcrusher",
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
                "id": "crush",
                "type": "crush",
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
            "crush": {
                "bits": 0.3,
                "rate": 0.3,
                "mix": 0.7
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "crush",
                "toPort": "inL"
            },
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "crush",
                "toPort": "inR"
            },
            {
                "fromModule": "crush",
                "fromPort": "outL",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "crush",
                "fromPort": "outR",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
