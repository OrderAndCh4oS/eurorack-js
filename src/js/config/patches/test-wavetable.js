/**
 * Test - Wavetable
 *
 * LFO-scanned wavetable oscillator through a VCA to stereo output.
 */
export default {
    "name": "Test - Wavetable",
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
                "id": "wave",
                "type": "wavetable",
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
                "rateKnob": 0.18,
                "waveKnob": 0.35,
                "range": 0
            },
            "wave": {
                "coarse": 0.36,
                "fine": 0,
                "bank": 3,
                "position": 0.15,
                "scanAmt": 0.65,
                "fmAmt": 0,
                "level": 0.9,
                "interp": 1
            },
            "vca": {
                "ch1Gain": 0.75,
                "ch2Gain": 0
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "wave",
                "toPort": "position"
            },
            {
                "fromModule": "wave",
                "fromPort": "out",
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
