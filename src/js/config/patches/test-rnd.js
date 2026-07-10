/**
 * Test - Random
 *
 * Demonstrates random voltage generator creating evolving textures:
 * - Step output quantized to VCO for random melodies
 * - Smooth output modulates filter for evolving timbre
 * - Gate output triggers envelope for rhythmic pulses
 *
 * Try adjusting rate for tempo and amp for pitch range.
 */
export default {
    "name": "Test - Rnd",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "rnd",
                "type": "rnd",
                "row": 1,
                "index": 0
            },
            {
                "id": "quant",
                "type": "quant",
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
            "rnd": {
                "rate": 0.7533,
                "amp": 0.6867
            },
            "quant": {
                "scale": 3,
                "octave": -1,
                "semitone": 0
            },
            "vco": {
                "coarse": 0.3367,
                "fine": 0,
                "glide": 5
            },
            "vcf": {
                "cutoff": 0.2533,
                "resonance": 0.7
            },
            "adsr": {
                "attack": 0.01,
                "decay": 0.3,
                "sustain": 0.2,
                "release": 0.62
            },
            "vca": {
                "ch1Gain": 0.6667,
                "ch2Gain": 0
            },
            "out": {
                "volume": 0.6
            }
        },
        "cables": [
            {
                "fromModule": "rnd",
                "fromPort": "step",
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
                "fromModule": "rnd",
                "fromPort": "gate",
                "toModule": "adsr",
                "toPort": "gate"
            },
            {
                "fromModule": "rnd",
                "fromPort": "smooth",
                "toModule": "vcf",
                "toPort": "cutoffCV"
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
