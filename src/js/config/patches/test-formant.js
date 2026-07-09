/**
 * Test - Formant
 *
 * Rich VCO saw through FORMANT, with an LFO sweeping vowel CV.
 */
export default {
    "name": "Test - Formant",
    "factory": true,
    "state": {
        "version": 2,
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
                "id": "formant",
                "type": "formant",
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
                "rateKnob": 0.34,
                "waveKnob": 0
            },
            "vco": {
                "coarse": 0.32,
                "fine": 0,
                "glide": 5
            },
            "formant": {
                "vowel": 0.15,
                "resonance": 0.72,
                "shift": 0.5,
                "drive": 0.45,
                "mix": 1
            },
            "out": {
                "volume": 0.65
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "formant",
                "toPort": "audio"
            },
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "formant",
                "toPort": "vowelCV"
            },
            {
                "fromModule": "formant",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "formant",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
