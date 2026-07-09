/**
 * Test Patch: Chorus
 *
 * Tests the chorus effect on a VCO triangle wave.
 * Creates a lush, widened sound with stereo modulation.
 */
export default {
    "name": "Test: Chorus",
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
                "id": "chorus",
                "type": "chorus",
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
                "coarse": 0.4,
                "fine": 0
            },
            "chorus": {
                "rate": 0.4,
                "depth": 0.6,
                "mix": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "chorus",
                "toPort": "inL"
            },
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "chorus",
                "toPort": "inR"
            },
            {
                "fromModule": "chorus",
                "fromPort": "outL",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "chorus",
                "fromPort": "outR",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
