/**
 * SFX - Explosion
 *
 * Big explosion sound effect with noise burst and sub rumble.
 * Combines filtered noise with pitch-dropping oscillator.
 *
 * Tweak controls:
 * - explodeEnv decay: Explosion length
 * - rumbleVco coarse: Sub frequency (lower = bigger explosion)
 * - noiseMix/rumbleMix: Balance noise vs sub
 * - filter cutoff: Brightness of initial blast
 * - verb mix: Size of space
 */
export default {
    "name": "SFX - Explosion",
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
                "id": "explodeEnv",
                "type": "adsr",
                "row": 1,
                "index": 1
            },
            {
                "id": "nse",
                "type": "nse",
                "row": 1,
                "index": 2
            },
            {
                "id": "noiseFilter",
                "type": "vcf",
                "row": 1,
                "index": 3
            },
            {
                "id": "rumbleVco",
                "type": "vco",
                "row": 1,
                "index": 4
            },
            {
                "id": "rumbleFilter",
                "type": "vcf",
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
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 7
            },
            {
                "id": "verb",
                "type": "verb",
                "row": 1,
                "index": 8
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 9
            }
        ],
        "params": {
            "clk": {
                "rate": 0.15
            },
            "explodeEnv": {
                "attack": 0,
                "decay": 0.7,
                "sustain": 0,
                "release": 0.77
            },
            "nse": {
                "rate": 0.23
            },
            "noiseFilter": {
                "cutoff": 0.37,
                "resonance": 0.2
            },
            "rumbleVco": {
                "coarse": 0.24,
                "fine": 0,
                "glide": 0
            },
            "rumbleFilter": {
                "cutoff": 0.26,
                "resonance": 0.5
            },
            "mix": {
                "lvl1": 0.8,
                "lvl2": 0.9,
                "lvl3": 0,
                "lvl4": 0
            },
            "vca": {
                "ch1Gain": 1,
                "ch2Gain": 0
            },
            "verb": {
                "time": 0.55,
                "damp": 0.17,
                "mix": 0.29
            },
            "out": {
                "volume": 0.75
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "explodeEnv",
                "toPort": "gate"
            },
            {
                "fromModule": "nse",
                "fromPort": "noise",
                "toModule": "noiseFilter",
                "toPort": "audio"
            },
            {
                "fromModule": "noiseFilter",
                "fromPort": "lpf",
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "explodeEnv",
                "fromPort": "env",
                "toModule": "noiseFilter",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "rumbleVco",
                "fromPort": "triangle",
                "toModule": "rumbleFilter",
                "toPort": "audio"
            },
            {
                "fromModule": "rumbleFilter",
                "fromPort": "lpf",
                "toModule": "mix",
                "toPort": "in2"
            },
            {
                "fromModule": "explodeEnv",
                "fromPort": "env",
                "toModule": "rumbleVco",
                "toPort": "fm"
            },
            {
                "fromModule": "mix",
                "fromPort": "out",
                "toModule": "vca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "explodeEnv",
                "fromPort": "env",
                "toModule": "vca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "verb",
                "toPort": "audioL"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "verb",
                "toPort": "audioR"
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
