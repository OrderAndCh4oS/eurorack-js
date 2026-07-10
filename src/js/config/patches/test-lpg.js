/**
 * Test - LPG
 *
 * Clock strikes a vactrol-style low pass gate fed by a VCO, producing plucked
 * combo-mode tones while the scope shows audio and trigger timing.
 */
export default {
    "name": "Test - LPG",
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
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 1
            },
            {
                "id": "lpg",
                "type": "lpg",
                "row": 1,
                "index": 2
            },
            {
                "id": "scope",
                "type": "scope",
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
                "rate": 0.28,
                "pause": 0
            },
            "vco": {
                "coarse": 0.34,
                "fine": 0,
                "glide": 5
            },
            "lpg": {
                "level": 0,
                "damp": 0.42,
                "tone": 0.72,
                "resonance": 0.18,
                "mode": 1
            },
            "scope": {
                "time": 0.38,
                "gain1": 0.5,
                "gain2": 0.5,
                "offset1": 0.5,
                "offset2": 0.5,
                "trigger": 0.52,
                "mode": 0
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "lpg",
                "toPort": "audio"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "lpg",
                "toPort": "strike"
            },
            {
                "fromModule": "lpg",
                "fromPort": "out",
                "toModule": "scope",
                "toPort": "in1"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "scope",
                "toPort": "in2"
            },
            {
                "fromModule": "lpg",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "lpg",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
