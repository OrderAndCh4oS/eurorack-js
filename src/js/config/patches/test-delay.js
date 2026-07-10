/**
 * Test - Delay
 * VCO through delay with LFO modulating delay time
 */
export default {
    "name": "Test - Delay",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "clk",
                "type": "clk",
                "row": 1,
                "index": 0
            },
            {
                "id": "lfo",
                "type": "lfo",
                "row": 1,
                "index": 1
            },
            {
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 2
            },
            {
                "id": "dly",
                "type": "dly",
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
            "clk": {
                "rate": 0.4,
                "pause": 0
            },
            "lfo": {
                "rateKnob": 0.11,
                "waveKnob": 0.2,
                "range": 0
            },
            "vco": {
                "coarse": 0.38,
                "fine": 0.5,
                "glide": 5
            },
            "dly": {
                "time": 0.4,
                "feedback": 0.6,
                "mix": 0.43
            },
            "out": {
                "volume": 0.6
            }
        },
        "cables": [
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "dly",
                "toPort": "timeCV"
            },
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "dly",
                "toPort": "audio"
            },
            {
                "fromModule": "dly",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "dly",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
