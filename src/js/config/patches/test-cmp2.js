/**
 * Test Patch: CMP2
 *
 * Demonstrates the dual window comparator extracting gates from LFOs.
 * øchd provides organic modulation, CMP2 converts to rhythmic gates.
 * OR output gives longer sustained gates for smoother sound.
 * Asymmetric windows (shift1=-1, shift2=+1) create interesting rhythms.
 */
export default {
    "name": "Test: CMP2",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "ochd",
                "type": "ochd",
                "row": 1,
                "index": 0
            },
            {
                "id": "cmp2",
                "type": "cmp2",
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
                "id": "adsr",
                "type": "adsr",
                "row": 1,
                "index": 4
            },
            {
                "id": "vca",
                "type": "vca",
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
            "ochd": {
                "rate": 0.67
            },
            "cmp2": {
                "shift1": -0.3333333333333339,
                "size1": 2.7299999999999986,
                "shift2": -1.2666666666666657,
                "size2": 3.2700000000000014
            },
            "vco": {
                "coarse": 0.4,
                "fine": 2,
                "glide": 0
            },
            "vcf": {
                "cutoff": 0.6933333333333332,
                "resonance": 0.5566666666666666
            },
            "adsr": {
                "attack": 0,
                "decay": 0.31333333333333335,
                "sustain": 0.04666666666666667,
                "release": 0.29333333333333333
            },
            "vca": {
                "ch1Gain": 0.7533333333333334,
                "ch2Gain": 0,
                "gain1": 0.7,
                "gain2": 0.7
            },
            "out": {
                "volume": 0.7066666666666667
            }
        },
        "cables": [
            {
                "fromModule": "ochd",
                "fromPort": "out1",
                "toModule": "cmp2",
                "toPort": "in1"
            },
            {
                "fromModule": "ochd",
                "fromPort": "out3",
                "toModule": "cmp2",
                "toPort": "in2"
            },
            {
                "fromModule": "cmp2",
                "fromPort": "or",
                "toModule": "adsr",
                "toPort": "gate"
            },
            {
                "fromModule": "vco",
                "fromPort": "triangle",
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
                "fromModule": "adsr",
                "fromPort": "env",
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
