/**
 * Custom Modules
 *
 * Exercises every custom-rendered module in one diagnostic patch:
 * sequencer, looper, recorder, scope, spectrum, plot, spectrogram, VU meter,
 * joystick, and low pass gate.
 */
export default {
    "name": "Test - Custom Modules",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "clock",
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
                "id": "env",
                "type": "adsr",
                "row": 1,
                "index": 5
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 1,
                "index": 6
            },
            {
                "id": "scope",
                "type": "scope",
                "row": 1,
                "index": 7
            },
            {
                "id": "spectrum",
                "type": "spectrum",
                "row": 1,
                "index": 8
            },
            {
                "id": "loop",
                "type": "loop",
                "row": 2,
                "index": 0
            },
            {
                "id": "plot",
                "type": "plot",
                "row": 2,
                "index": 1
            },
            {
                "id": "spectrogram",
                "type": "spectrogram",
                "row": 2,
                "index": 2
            },
            {
                "id": "db",
                "type": "db",
                "row": 2,
                "index": 3
            },
            {
                "id": "rec",
                "type": "rec",
                "row": 2,
                "index": 4
            },
            {
                "id": "out",
                "type": "out",
                "row": 2,
                "index": 5
            },
            {
                "id": "joy",
                "type": "joystick",
                "row": 3,
                "index": 0
            },
            {
                "id": "lpg",
                "type": "lpg",
                "row": 3,
                "index": 1
            }
        ],
        "params": {
            "clock": {
                "rate": 0.32,
                "pause": 0
            },
            "seq": {
                "step1": 0.08,
                "step2": 0.2,
                "step3": 0.32,
                "step4": 0.15,
                "step5": 0.42,
                "step6": 0.26,
                "step7": 0.36,
                "step8": 0.18,
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
                "gate8": 1
            },
            "quant": {
                "scale": 2,
                "octave": 0,
                "semitone": 0
            },
            "vco": {
                "coarse": 0.36,
                "fine": 0,
                "glide": 3
            },
            "vcf": {
                "cutoff": 0.48,
                "resonance": 0.34
            },
            "env": {
                "attack": 0.03,
                "decay": 0.22,
                "sustain": 0.42,
                "release": 0.18
            },
            "vca": {
                "ch1Gain": 0.88,
                "ch2Gain": 0
            },
            "scope": {
                "time": 0.42,
                "trigger": 0.5,
                "mode": 0,
                "gain1": 0.56,
                "gain2": 0.56,
                "offset1": 0.5,
                "offset2": 0.5
            },
            "spectrum": {
                "floor": 0.42,
                "decay": 0.56,
                "scale": 1
            },
            "loop": {
                "length": 0.68,
                "mix": 0.65,
                "level": 0.82,
                "record": 0,
                "reverse": 0,
                "halfSpeed": 0,
                "clear": 0,
                "mode": 0
            },
            "plot": {
                "time": 0.5,
                "freeze": 0
            },
            "spectrogram": {
                "time": 0.48,
                "floor": 0.44,
                "freeze": 0
            },
            "db": {
                "mode": 2,
                "hold": 1
            },
            "rec": {
                "record": 0
            },
            "out": {
                "volume": 0.72
            },
            "joy": {
                "x": 0.2,
                "y": -0.25,
                "cv1Amt": 0.5,
                "cv2Amt": 0.5,
                "range": 0,
                "sense": 1,
                "gateButton": 0,
                "record": 0,
                "play": 0,
                "cvMode": 0,
                "loopMode": 1
            },
            "lpg": {
                "level": 0.8,
                "damp": 0.35,
                "tone": 0.65,
                "resonance": 0.1,
                "mode": 1
            }
        },
        "cables": [
            {
                "fromModule": "clock",
                "fromPort": "clock",
                "toModule": "seq",
                "toPort": "clock"
            },
            {
                "fromModule": "seq",
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
                "fromModule": "seq",
                "fromPort": "gate",
                "toModule": "env",
                "toPort": "gate"
            },
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "vcf",
                "toPort": "audio"
            },
            {
                "fromModule": "env",
                "fromPort": "env",
                "toModule": "vcf",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "vcf",
                "fromPort": "lpf",
                "toModule": "lpg",
                "toPort": "audio"
            },
            {
                "fromModule": "env",
                "fromPort": "env",
                "toModule": "lpg",
                "toPort": "cv"
            },
            {
                "fromModule": "seq",
                "fromPort": "gate",
                "toModule": "lpg",
                "toPort": "strike"
            },
            {
                "fromModule": "joy",
                "fromPort": "x",
                "toModule": "vcf",
                "toPort": "resCV"
            },
            {
                "fromModule": "joy",
                "fromPort": "y",
                "toModule": "lpg",
                "toPort": "dampCV"
            },
            {
                "fromModule": "joy",
                "fromPort": "trig",
                "toModule": "loop",
                "toPort": "reverseTrig"
            },
            {
                "fromModule": "lpg",
                "fromPort": "out",
                "toModule": "vca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "loop",
                "toPort": "in"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "scope",
                "toPort": "in1"
            },
            {
                "fromModule": "loop",
                "fromPort": "out",
                "toModule": "scope",
                "toPort": "in2"
            },
            {
                "fromModule": "loop",
                "fromPort": "out",
                "toModule": "plot",
                "toPort": "audio"
            },
            {
                "fromModule": "seq",
                "fromPort": "gate",
                "toModule": "plot",
                "toPort": "trig"
            },
            {
                "fromModule": "plot",
                "fromPort": "out",
                "toModule": "spectrogram",
                "toPort": "audio"
            },
            {
                "fromModule": "spectrogram",
                "fromPort": "out",
                "toModule": "spectrum",
                "toPort": "audio"
            },
            {
                "fromModule": "spectrum",
                "fromPort": "out",
                "toModule": "db",
                "toPort": "L"
            },
            {
                "fromModule": "spectrum",
                "fromPort": "out",
                "toModule": "db",
                "toPort": "R"
            },
            {
                "fromModule": "db",
                "fromPort": "outL",
                "toModule": "rec",
                "toPort": "L"
            },
            {
                "fromModule": "db",
                "fromPort": "outR",
                "toModule": "rec",
                "toPort": "R"
            },
            {
                "fromModule": "rec",
                "fromPort": "outL",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "rec",
                "fromPort": "outR",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
