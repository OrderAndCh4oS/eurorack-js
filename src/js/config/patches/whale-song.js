/**
 * Whale Song
 *
 * Dark, cavernous atmosphere with slow melancholic melody.
 * Inspired by Lorn's brooding electronic sound and Dreadbox Nyx's
 * thick analog character.
 *
 * - Detuned drone oscillators through dark filter
 * - Slow melodic sequence weaving through
 * - Deep chorus for Nyx-style depth
 * - Reverb and delay for space
 */
export default {
    "name": "Demo - Whale Song",
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
                "id": "ochd",
                "type": "ochd",
                "row": 1,
                "index": 4
            },
            {
                "id": "drone1",
                "type": "vco",
                "row": 2,
                "index": 5
            },
            {
                "id": "drone2",
                "type": "vco",
                "row": 2,
                "index": 6
            },
            {
                "id": "droneMix",
                "type": "mix",
                "row": 2,
                "index": 7
            },
            {
                "id": "droneFilter",
                "type": "vcf",
                "row": 2,
                "index": 8
            },
            {
                "id": "droneVca",
                "type": "vca",
                "row": 2,
                "index": 9
            },
            {
                "id": "seq",
                "type": "seq",
                "row": 3,
                "index": 10
            },
            {
                "id": "slew",
                "type": "slew",
                "row": 3,
                "index": 11
            },
            {
                "id": "melody",
                "type": "vco",
                "row": 3,
                "index": 12
            },
            {
                "id": "melodyFilter",
                "type": "vcf",
                "row": 3,
                "index": 13
            },
            {
                "id": "env",
                "type": "adsr",
                "row": 3,
                "index": 14
            },
            {
                "id": "melodyVca",
                "type": "vca",
                "row": 3,
                "index": 15
            },
            {
                "id": "mainMix",
                "type": "mix",
                "row": 4,
                "index": 16
            },
            {
                "id": "chorus",
                "type": "chorus",
                "row": 4,
                "index": 17
            },
            {
                "id": "verb",
                "type": "verb",
                "row": 4,
                "index": 18
            },
            {
                "id": "dly",
                "type": "dly",
                "row": 4,
                "index": 19
            },
            {
                "id": "out",
                "type": "out",
                "row": 4,
                "index": 20
            }
        ],
        "params": {
            "clk": {
                "rate": 0.18
            },
            "div": {
                "rate1": 0.3,
                "rate2": 0.5
            },
            "lfo1": {
                "rateKnob": 0.08,
                "waveKnob": 0.2,
                "range": 1
            },
            "lfo2": {
                "rateKnob": 0.12,
                "waveKnob": 0.3,
                "range": 1
            },
            "ochd": {
                "rate": 0.15
            },
            "drone1": {
                "coarse": 0.2,
                "fine": -0.5,
                "glide": 5
            },
            "drone2": {
                "coarse": 0.2,
                "fine": 0.5,
                "glide": 5
            },
            "droneMix": {
                "lvl1": 0.7,
                "lvl2": 0.7,
                "lvl3": 0,
                "lvl4": 0
            },
            "droneFilter": {
                "cutoff": 0.25,
                "resonance": 0.4
            },
            "droneVca": {
                "ch1Gain": 0.6,
                "ch2Gain": 0
            },
            "seq": {
                "step1": 0.3,
                "step2": 0.35,
                "step3": 0.4,
                "step4": 0.35,
                "step5": 0.45,
                "step6": 0.4,
                "step7": 0.35,
                "step8": 0.3,
                "length": 8,
                "direction": 0
            },
            "slew": {
                "rate1": 0.6,
                "rate2": 0.6
            },
            "melody": {
                "coarse": 0.35,
                "fine": 0,
                "glide": 10
            },
            "melodyFilter": {
                "cutoff": 0.35,
                "resonance": 0.3
            },
            "env": {
                "attack": 0.4,
                "decay": 0.5,
                "sustain": 0.4,
                "release": 0.7
            },
            "melodyVca": {
                "ch1Gain": 0.5,
                "ch2Gain": 0
            },
            "mainMix": {
                "lvl1": 0.8,
                "lvl2": 0.6,
                "lvl3": 0,
                "lvl4": 0
            },
            "chorus": {
                "rate": 0.3,
                "depth": 0.6,
                "mix": 0.5
            },
            "verb": {
                "time": 0.8,
                "mix": 0.5,
                "damp": 0.4
            },
            "dly": {
                "time": 0.45,
                "feedback": 0.5,
                "mix": 0.3
            },
            "out": {
                "volume": 0.7
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
                "toModule": "drone1",
                "toPort": "fm"
            },
            {
                "fromModule": "ochd",
                "fromPort": "out1",
                "toModule": "drone2",
                "toPort": "fm"
            },
            {
                "fromModule": "ochd",
                "fromPort": "out3",
                "toModule": "melodyFilter",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "drone1",
                "fromPort": "pulse",
                "toModule": "droneMix",
                "toPort": "in1"
            },
            {
                "fromModule": "drone2",
                "fromPort": "pulse",
                "toModule": "droneMix",
                "toPort": "in2"
            },
            {
                "fromModule": "droneMix",
                "fromPort": "out",
                "toModule": "droneFilter",
                "toPort": "audio"
            },
            {
                "fromModule": "droneFilter",
                "fromPort": "lpf",
                "toModule": "droneVca",
                "toPort": "ch1In"
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
                "fromModule": "env",
                "fromPort": "env",
                "toModule": "melodyFilter",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "droneVca",
                "fromPort": "ch1Out",
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
                "toModule": "chorus",
                "toPort": "inL"
            },
            {
                "fromModule": "mainMix",
                "fromPort": "out",
                "toModule": "chorus",
                "toPort": "inR"
            },
            {
                "fromModule": "chorus",
                "fromPort": "outL",
                "toModule": "verb",
                "toPort": "audioL"
            },
            {
                "fromModule": "chorus",
                "fromPort": "outR",
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
