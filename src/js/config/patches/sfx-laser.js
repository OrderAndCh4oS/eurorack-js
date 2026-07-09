/**
 * SFX - Laser
 *
 * Classic sci-fi laser/blaster sound effect.
 * Pitch sweep with bright, cutting character.
 *
 * Tweak controls:
 * - pitchEnv rise/fall: Sweep shape
 * - vco coarse: Starting pitch (higher = smaller weapon)
 * - filter cutoff: Brightness/bite
 * - filter resonance: Add whistle/zing
 */
export default {
    "name": "SFX - Laser",
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
                "id": "pitchEnv",
                "type": "func",
                "row": 1,
                "index": 1
            },
            {
                "id": "ampEnv",
                "type": "adsr",
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
                "id": "filter",
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
                "id": "verb",
                "type": "verb",
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
                "rate": 0.1
            },
            "pitchEnv": {
                "rise": 0.41,
                "fall": 0.67,
                "curve": 0.59
            },
            "ampEnv": {
                "attack": 0,
                "decay": 0.25,
                "sustain": 0,
                "release": 0.82
            },
            "vco": {
                "coarse": 0.24,
                "fine": 0,
                "glide": 0
            },
            "filter": {
                "cutoff": 0.6,
                "resonance": 0.66
            },
            "vca": {
                "ch1Gain": 0.33,
                "ch2Gain": 0
            },
            "verb": {
                "time": 0.35,
                "damp": 0.26,
                "mix": 0.18
            },
            "out": {
                "volume": 0.68
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "pitchEnv",
                "toPort": "trig"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "ampEnv",
                "toPort": "gate"
            },
            {
                "fromModule": "pitchEnv",
                "fromPort": "out",
                "toModule": "vco",
                "toPort": "fm"
            },
            {
                "fromModule": "vco",
                "fromPort": "ramp",
                "toModule": "filter",
                "toPort": "audio"
            },
            {
                "fromModule": "filter",
                "fromPort": "hpf",
                "toModule": "vca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "ampEnv",
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
