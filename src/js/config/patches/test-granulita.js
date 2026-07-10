/**
 * Test - Granulita
 * VCO into a wet-only granular chord generator with reverb
 * Tests granular synthesis, chord generation, and shimmer reverb
 */
export default {
    "name": "Test - Granulita",
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
                "id": "granulita",
                "type": "granulita",
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
                "rate": 0.25,
                "pause": 0
            },
            "lfo": {
                "rateKnob": 0.15,
                "range": 0
            },
            "vco": {
                "coarse": 0.35,
                "fine": 0.5
            },
            "granulita": {
                "blend": 1,
                "pitch": 0.5,
                "chord": 0.2,
                "voice": 0,
                "verb": 0.4,
                "count": 0.4,
                "length": 0.35,
                "direction": 2,
                "hitMode": 1
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "granulita",
                "toPort": "inL"
            },
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "granulita",
                "toPort": "pitchCV"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "granulita",
                "toPort": "hit"
            },
            {
                "fromModule": "granulita",
                "fromPort": "outL",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "granulita",
                "fromPort": "outR",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
