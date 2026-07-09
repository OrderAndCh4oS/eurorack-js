/**
 * Demo - S&H Random
 * Random melody using sample & hold with quantizer
 * Clock triggers S&H and ADSR for rhythmic random bleeps
 */
export default {
    "name": "Demo - S&H Random",
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
                "id": "nse",
                "type": "nse",
                "row": 1,
                "index": 1
            },
            {
                "id": "sh",
                "type": "sh",
                "row": 1,
                "index": 2
            },
            {
                "id": "quant",
                "type": "quant",
                "row": 1,
                "index": 3
            },
            {
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 4
            },
            {
                "id": "vcf",
                "type": "vcf",
                "row": 1,
                "index": 5
            },
            {
                "id": "adsr",
                "type": "adsr",
                "row": 1,
                "index": 6
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 7
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 8
            }
        ],
        "params": {
            "clk": {
                "rate": 0.35,
                "pause": 0
            },
            "nse": {
                "color": 0.5
            },
            "sh": {
                "slew1": 0.1,
                "slew2": 0
            },
            "quant": {
                "scale": 10,
                "octave": 0,
                "semitone": 0
            },
            "vco": {
                "coarse": 0.4,
                "fine": 0,
                "glide": 0.1
            },
            "vcf": {
                "cutoff": 0.6,
                "resonance": 0.3
            },
            "adsr": {
                "attack": 0.01,
                "decay": 0.25,
                "sustain": 0.2,
                "release": 0.3
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
                "fromModule": "nse",
                "fromPort": "noise",
                "toModule": "sh",
                "toPort": "in1"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "sh",
                "toPort": "trig1"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "adsr",
                "toPort": "gate"
            },
            {
                "fromModule": "sh",
                "fromPort": "out1",
                "toModule": "quant",
                "toPort": "cv"
            },
            {
                "fromModule": "quant",
                "fromPort": "cv",
                "toModule": "vco",
                "toPort": "vOct"
            },
            {
                "fromModule": "vco",
                "fromPort": "pulse",
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
