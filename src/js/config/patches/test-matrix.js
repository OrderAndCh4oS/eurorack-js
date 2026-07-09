/**
 * Test - Matrix Mixer
 *
 * Demonstrates matrix routing:
 * - VCO triangle and pulse are blended to output A
 * - LFO is routed separately to output B for VCA modulation
 */
export default {
    "name": "Test - Matrix Mixer",
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
                "id": "matrix",
                "type": "matrix",
                "row": 1,
                "index": 2
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 3
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 4
            }
        ],
        "params": {
            "lfo": {
                "rateKnob": 0.35,
                "waveKnob": 0
            },
            "vco": {
                "coarse": 0.35,
                "fine": 0,
                "glide": 0
            },
            "matrix": {
                "a1": 0.55,
                "a2": 0.25,
                "a3": 0,
                "a4": 0,
                "b1": 0,
                "b2": 0,
                "b3": 0.55,
                "b4": 0,
                "c1": 0,
                "c2": 0,
                "c3": 0,
                "c4": 0,
                "d1": 0,
                "d2": 0,
                "d3": 0,
                "d4": 0,
                "modeA": 0,
                "modeB": 0,
                "modeC": 0,
                "modeD": 0
            },
            "vca": {
                "ch1Gain": 0.75,
                "ch2Gain": 0.75
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "matrix",
                "toPort": "in1"
            },
            {
                "fromModule": "vco",
                "fromPort": "pulse",
                "toModule": "matrix",
                "toPort": "in2"
            },
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "matrix",
                "toPort": "in3"
            },
            {
                "fromModule": "matrix",
                "fromPort": "outA",
                "toModule": "vca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "matrix",
                "fromPort": "outB",
                "toModule": "vca",
                "toPort": "ch1CV"
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
