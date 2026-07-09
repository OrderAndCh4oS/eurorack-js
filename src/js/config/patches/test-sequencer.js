/**
 * Test - Sequencer
 * 8-step sequencer driving a VCO through a VCF
 */
export default {
    "name": "Test - Sequencer",
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
                "id": "seq",
                "type": "seq",
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
                "id": "adsr",
                "type": "adsr",
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
                "rate": 0.35,
                "pause": 0
            },
            "seq": {
                "step1": 0,
                "step2": 0.2,
                "step3": 0.4,
                "step4": 0.6,
                "step5": 0.8,
                "step6": 0.6,
                "step7": 0.4,
                "step8": 0.2,
                "length": 8,
                "range": 1,
                "direction": 0,
                "gate1": 1,
                "gate2": 1,
                "gate3": 0,
                "gate4": 1,
                "gate5": 1,
                "gate6": 0,
                "gate7": 1,
                "gate8": 0
            },
            "vco": {
                "coarse": 0.29333333333333333,
                "fine": 0.5,
                "glide": 0.2
            },
            "vcf": {
                "cutoff": 0.6733333333333333,
                "resonance": 0.26666666666666666
            },
            "vca": {
                "ch1Gain": 0,
                "ch2Gain": 0.8
            },
            "adsr": {
                "attack": 0,
                "decay": 0.3,
                "sustain": 0.5,
                "release": 0
            },
            "out": {
                "volume": 0.6
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "seq",
                "toPort": "clock"
            },
            {
                "fromModule": "seq",
                "fromPort": "cv",
                "toModule": "vco",
                "toPort": "vOct"
            },
            {
                "fromModule": "seq",
                "fromPort": "gate",
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
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch2Out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
