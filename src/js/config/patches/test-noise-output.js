/**
 * Test - Noise Output
 * Noise generator test
 */
export default {
    "name": "Test - Noise Output",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "nse",
                "type": "nse",
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
            "nse": {
                "rate": 0.8,
                "vcaMode": 0
            },
            "vca": {
                "ch1Gain": 0.5,
                "ch2Gain": 0.5
            },
            "out": {
                "volume": 0.4
            }
        },
        "cables": [
            {
                "fromModule": "nse",
                "fromPort": "noise",
                "toModule": "vca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "nse",
                "fromPort": "noise",
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
