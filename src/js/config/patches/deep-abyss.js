/**
 * Deep Abyss
 *
 * Subterranean darkness. Massive low-end drone with glacial movement.
 * Sparse, haunting melody fragments emerging from the depths.
 *
 * - Sub-bass drone with slow filter sweeps
 * - Ring mod for metallic tension
 * - Sparse melody with heavy portamento
 * - Cavernous reverb, long delay trails
 */
export default {
    "name": "Demo - Deep Abyss",
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
                "id": "div",
                "type": "div",
                "row": 1,
                "index": 1
            },
            {
                "id": "lfo1",
                "type": "lfo",
                "row": 1,
                "index": 2
            },
            {
                "id": "lfo2",
                "type": "lfo",
                "row": 1,
                "index": 3
            },
            {
                "id": "nse",
                "type": "nse",
                "row": 1,
                "index": 4
            },
            {
                "id": "sub1",
                "type": "vco",
                "row": 2,
                "index": 0
            },
            {
                "id": "sub2",
                "type": "vco",
                "row": 2,
                "index": 1
            },
            {
                "id": "ring",
                "type": "ring",
                "row": 2,
                "index": 2
            },
            {
                "id": "droneMix",
                "type": "mix",
                "row": 2,
                "index": 3
            },
            {
                "id": "droneFilter",
                "type": "vcf",
                "row": 2,
                "index": 4
            },
            {
                "id": "seq",
                "type": "seq",
                "row": 3,
                "index": 0
            },
            {
                "id": "slew",
                "type": "slew",
                "row": 3,
                "index": 1
            },
            {
                "id": "melody",
                "type": "vco",
                "row": 3,
                "index": 2
            },
            {
                "id": "melodyFilter",
                "type": "vcf",
                "row": 3,
                "index": 3
            },
            {
                "id": "env",
                "type": "adsr",
                "row": 3,
                "index": 4
            },
            {
                "id": "melodyVca",
                "type": "vca",
                "row": 3,
                "index": 5
            },
            {
                "id": "mainMix",
                "type": "mix",
                "row": 4,
                "index": 0
            },
            {
                "id": "masterFilter",
                "type": "vcf",
                "row": 4,
                "index": 1
            },
            {
                "id": "verb",
                "type": "verb",
                "row": 4,
                "index": 2
            },
            {
                "id": "dly",
                "type": "dly",
                "row": 4,
                "index": 3
            },
            {
                "id": "out",
                "type": "out",
                "row": 4,
                "index": 4
            }
        ],
        "params": {
            "clk": {
                "rate": 0.273,
                "pause": 0
            },
            "div": {
                "rate1": 0.2,
                "rate2": 0.4
            },
            "lfo1": {
                "rateKnob": 0.05,
                "waveKnob": 0.3,
                "range": 1
            },
            "lfo2": {
                "rateKnob": 0.03,
                "waveKnob": 0.5,
                "range": 1
            },
            "nse": {
                "rate": 1,
                "vcaMode": 0
            },
            "sub1": {
                "coarse": 0.267,
                "fine": -0.3,
                "glide": 20
            },
            "sub2": {
                "coarse": 0.34,
                "fine": 0.3,
                "glide": 20
            },
            "ring": {
                "mix": 1
            },
            "droneMix": {
                "lvl1": 0.8466666666666667,
                "lvl2": 0.6799999999999999,
                "lvl3": 0.38,
                "lvl4": 0
            },
            "droneFilter": {
                "cutoff": 0.65,
                "resonance": 0.4866666666666667
            },
            "seq": {
                "step1": 0.25,
                "step2": 0,
                "step3": 0.35,
                "step4": 0,
                "step5": 0.3,
                "step6": 0,
                "step7": 0.4,
                "step8": 0.25,
                "length": 8,
                "range": 1,
                "direction": 0,
                "gate1": 1,
                "gate2": 1,
                "gate3": 1,
                "gate4": 1,
                "gate5": 1,
                "gate6": 1,
                "gate7": 1,
                "gate8": 1
            },
            "slew": {
                "rate1": 0.8,
                "rate2": 0.8
            },
            "melody": {
                "coarse": 0.417,
                "fine": 0,
                "glide": 30
            },
            "melodyFilter": {
                "cutoff": 0.24,
                "resonance": 0.4
            },
            "env": {
                "attack": 0.6,
                "decay": 0.6,
                "sustain": 0.3,
                "release": 0.8
            },
            "melodyVca": {
                "ch1Gain": 0.3,
                "ch2Gain": 0
            },
            "mainMix": {
                "lvl1": 0.88,
                "lvl2": 0.7466666666666666,
                "lvl3": 0,
                "lvl4": 0
            },
            "masterFilter": {
                "cutoff": 0.35333333333333333,
                "resonance": 0.2
            },
            "verb": {
                "time": 0.95,
                "damp": 0.6,
                "mix": 0.6
            },
            "dly": {
                "time": 0.6,
                "feedback": 0.7,
                "mix": 0.4
            },
            "out": {
                "volume": 0.75
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "div",
                "toPort": "clock"
            },
            {
                "fromModule": "div",
                "fromPort": "out2",
                "toModule": "seq",
                "toPort": "clock"
            },
            {
                "fromModule": "seq",
                "fromPort": "gate",
                "toModule": "env",
                "toPort": "gate"
            },
            {
                "fromModule": "lfo1",
                "fromPort": "primary",
                "toModule": "droneFilter",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "lfo2",
                "fromPort": "primary",
                "toModule": "masterFilter",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "sub1",
                "fromPort": "triangle",
                "toModule": "droneMix",
                "toPort": "in1"
            },
            {
                "fromModule": "sub2",
                "fromPort": "triangle",
                "toModule": "droneMix",
                "toPort": "in2"
            },
            {
                "fromModule": "sub1",
                "fromPort": "ramp",
                "toModule": "ring",
                "toPort": "x"
            },
            {
                "fromModule": "nse",
                "fromPort": "noise",
                "toModule": "ring",
                "toPort": "y"
            },
            {
                "fromModule": "ring",
                "fromPort": "out",
                "toModule": "droneMix",
                "toPort": "in3"
            },
            {
                "fromModule": "droneMix",
                "fromPort": "out",
                "toModule": "droneFilter",
                "toPort": "audio"
            },
            {
                "fromModule": "seq",
                "fromPort": "cv",
                "toModule": "slew",
                "toPort": "in1"
            },
            {
                "fromModule": "slew",
                "fromPort": "out1",
                "toModule": "melody",
                "toPort": "vOct"
            },
            {
                "fromModule": "melody",
                "fromPort": "triangle",
                "toModule": "melodyFilter",
                "toPort": "audio"
            },
            {
                "fromModule": "melodyFilter",
                "fromPort": "lpf",
                "toModule": "melodyVca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "env",
                "fromPort": "env",
                "toModule": "melodyVca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "droneFilter",
                "fromPort": "lpf",
                "toModule": "mainMix",
                "toPort": "in1"
            },
            {
                "fromModule": "melodyVca",
                "fromPort": "ch1Out",
                "toModule": "mainMix",
                "toPort": "in2"
            },
            {
                "fromModule": "mainMix",
                "fromPort": "out",
                "toModule": "masterFilter",
                "toPort": "audio"
            },
            {
                "fromModule": "masterFilter",
                "fromPort": "lpf",
                "toModule": "verb",
                "toPort": "audioL"
            },
            {
                "fromModule": "masterFilter",
                "fromPort": "lpf",
                "toModule": "verb",
                "toPort": "audioR"
            },
            {
                "fromModule": "verb",
                "fromPort": "outL",
                "toModule": "dly",
                "toPort": "audio"
            },
            {
                "fromModule": "dly",
                "fromPort": "out",
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
