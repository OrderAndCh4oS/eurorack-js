/**
 * Test - LFO → VCO Pitch
 * LFO modulating VCO pitch
 */
export default {
    "name": "Test - LFO → VCO Pitch",
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
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 1
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 2
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 3
            }
        ],
        "params": {
            "lfo": {
                "rateKnob": 0.5,
                "waveKnob": 0,
                "range": 0
            },
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
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "vco",
                "toPort": "vOct"
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
