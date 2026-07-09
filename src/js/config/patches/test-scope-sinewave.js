/**
 * Test - Scope Sine Wave
 *
 * Simple patch to display a classic waveform on the oscilloscope.
 * VCO triangle output (closest to sine wave) patched to scope input.
 * Also routed to output so you can hear it.
 */
export default {
    "name": "Test - Scope Sine Wave",
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
                "id": "scope",
                "type": "scope",
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
                "rateKnob": 0.85,
                "waveKnob": 0,
                "range": 1
            },
            "vco": {
                "coarse": 0.3,
                "fine": 0,
                "glide": 0
            },
            "scope": {
                "time": 0.3,
                "trigger": 0.5
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "scope",
                "toPort": "in1"
            },
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "scope",
                "toPort": "in2"
            },
            {
                "fromModule": "scope",
                "fromPort": "out1",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "scope",
                "fromPort": "out1",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
