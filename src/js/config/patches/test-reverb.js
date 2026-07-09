/**
 * Test - Reverb
 * VCO through VCF through stereo reverb
 */
export default {
    "name": "Test - Reverb",
    "factory": true,
    "state": {
        "version": 2,
        "modules": [
            {
                "id": "clk",
                "type": "clk",
                "row": 1,
                "index": 0
            },
            {
                "id": "adsr",
                "type": "adsr",
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
                "id": "vcf",
                "type": "vcf",
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
                "id": "verb",
                "type": "verb",
                "row": 1,
                "index": 5
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 6
            }
        ],
        "params": {
            "clk": {
                "rate": 0.3,
                "pause": 0
            },
            "adsr": {
                "attack": 0.05,
                "decay": 0.4,
                "sustain": 0.3,
                "release": 0.5
            },
            "vco": {
                "coarse": 0.4,
                "fine": 0.5
            },
            "vcf": {
                "cutoff": 0.6,
                "resonance": 0.3
            },
            "vca": {
                "ch1Gain": 0,
                "ch2Gain": 0.8
            },
            "verb": {
                "time": 0.7,
                "damp": 0.4,
                "mix": 0.5
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
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vcf",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "vcf",
                "fromPort": "lpf",
                "toModule": "vca",
                "toPort": "ch2In"
            },
            {
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vca",
                "toPort": "ch2CV"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch2Out",
                "toModule": "verb",
                "toPort": "audioL"
            },
            {
                "fromModule": "verb",
                "fromPort": "outL",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "verb",
                "fromPort": "outR",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
