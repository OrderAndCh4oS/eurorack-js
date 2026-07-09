/**
 * Test - VCO Only
 * Isolated VCO test with triangle and ramp outputs
 */
export default {
    "name": "Test - VCO Only",
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
                "id": "vca",
                "type": "vca",
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
                "fine": 0,
                "glide": 5
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
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "vca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "vca",
                "toPort": "ch2In"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch2Out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
