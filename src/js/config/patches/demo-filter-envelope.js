/**
 * Demo - Filter Envelope
 * Classic filter sweep with envelope
 */
export default {
    "name": "Demo - Filter Envelope",
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
                "id": "vcf",
                "type": "vcf",
                "row": 1,
                "index": 2
            },
            {
                "id": "adsr",
                "type": "adsr",
                "row": 1,
                "index": 3
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 4
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 5
            }
        ],
        "params": {
            "clk": {
                "rate": 0.3,
                "pause": 0
            },
            "vco": {
                "coarse": 0.25,
                "fine": 0,
                "glide": 0
            },
            "vcf": {
                "cutoff": 0.5366666666666666,
                "resonance": 0.75
            },
            "adsr": {
                "attack": 0,
                "decay": 0.35,
                "sustain": 0.2,
                "release": 0.7
            },
            "vca": {
                "ch1Gain": 0.8,
                "ch2Gain": 0.8
            },
            "out": {
                "volume": 0.6
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "adsr",
                "toPort": "gate"
            },
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "vcf",
                "toPort": "audio"
            },
            {
                "fromModule": "vcf",
                "fromPort": "lpf",
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
            },
            {
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vcf",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vca",
                "toPort": "ch1CV"
            }
        ],
        "midiMappings": {}
    }
};
