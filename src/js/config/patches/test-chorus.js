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
        "version": 3,
        "plugins": { "core": 1 },
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
                "coarse": 0.5566666666666665,
                "fine": 0,
                "glide": 5
            },
            "chorus": {
                "rate": 0.3533333333333334,
                "depth": 0.4666666666666667,
                "mix": 0.7
            },
            "out": {
                "volume": 0.8
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
