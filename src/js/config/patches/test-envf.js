/**
 * Test - Envelope Follower
 *
 * Simple demonstration of envelope follower:
 * - LFO modulates VCO1 creating varying amplitude
 * - Envelope follower tracks VCO1's amplitude
 * - Envelope controls VCA on VCO2
 * - VCO2 plays when VCO1 is loud
 *
 * You should hear VCO2 (higher pitch) follow the dynamics of VCO1.
 */
export default {
    "name": "Test - Envf",
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
                "id": "vco1",
                "type": "vco",
                "row": 1,
                "index": 1
            },
            {
                "id": "vca1",
                "type": "vca",
                "row": 1,
                "index": 2
            },
            {
                "id": "envf",
                "type": "envf",
                "row": 1,
                "index": 3
            },
            {
                "id": "vco2",
                "type": "vco",
                "row": 1,
                "index": 4
            },
            {
                "id": "vca2",
                "type": "vca",
                "row": 1,
                "index": 5
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 1,
                "index": 6
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 7
            }
        ],
        "params": {
            "lfo": {
                "rateKnob": 0.25,
                "waveKnob": 0,
                "range": 0
            },
            "vco1": {
                "coarse": 0.35,
                "fine": 0,
                "glide": 5
            },
            "vca1": {
                "ch1Gain": 1,
                "ch2Gain": 0.8
            },
            "envf": {
                "threshold": 0.34,
                "gain": 1,
                "slope": 0
            },
            "vco2": {
                "coarse": 0.55,
                "fine": 0,
                "glide": 5
            },
            "vca2": {
                "ch1Gain": 1,
                "ch2Gain": 0.8
            },
            "mix": {
                "lvl1": 0.8,
                "lvl2": 0.8,
                "lvl3": 0.8,
                "lvl4": 0.8
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "vca1",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "vco1",
                "fromPort": "triangle",
                "toModule": "vca1",
                "toPort": "ch1In"
            },
            {
                "fromModule": "vca1",
                "fromPort": "ch1Out",
                "toModule": "envf",
                "toPort": "audio"
            },
            {
                "fromModule": "vco2",
                "fromPort": "triangle",
                "toModule": "vca2",
                "toPort": "ch1In"
            },
            {
                "fromModule": "envf",
                "fromPort": "env",
                "toModule": "vca2",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "vca1",
                "fromPort": "ch1Out",
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "vca2",
                "fromPort": "ch1Out",
                "toModule": "mix",
                "toPort": "in2"
            },
            {
                "fromModule": "mix",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "mix",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
