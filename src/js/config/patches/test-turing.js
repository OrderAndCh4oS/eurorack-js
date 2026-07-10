/**
 * Test Patch: Turing Machine
 *
 * Demonstrates the Turing Machine random looping sequencer.
 * Clock drives the Turing, CV output goes through quantizer to VCO.
 * Adjust Lock knob to control randomness vs locked patterns.
 */
export default {
    "name": "Test: Turing",
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
                "id": "turing",
                "type": "turing",
                "row": 1,
                "index": 1
            },
            {
                "id": "quant",
                "type": "quant",
                "row": 1,
                "index": 2
            },
            {
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 3
            },
            {
                "id": "vcf",
                "type": "vcf",
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
                "id": "adsr",
                "type": "adsr",
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
            "clk": {
                "rate": 0.3,
                "pause": 0
            },
            "turing": {
                "lock": 0.75,
                "scale": 0.6,
                "length": 5
            },
            "quant": {
                "scale": 5,
                "octave": 0,
                "semitone": 0
            },
            "vco": {
                "coarse": 0.3,
                "fine": 0,
                "glide": 11.33
            },
            "vcf": {
                "cutoff": 0.51,
                "resonance": 0.25
            },
            "vca": {
                "ch1Gain": 0.8,
                "ch2Gain": 0.8,
                "gain1": 0.7,
                "gain2": 0.7
            },
            "adsr": {
                "attack": 0,
                "decay": 0.3,
                "sustain": 0.4,
                "release": 0.7066666666666667
            },
            "out": {
                "volume": 0.8
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "turing",
                "toPort": "clock"
            },
            {
                "fromModule": "turing",
                "fromPort": "cv",
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
                "fromModule": "turing",
                "fromPort": "pulse",
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
