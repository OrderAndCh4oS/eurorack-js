/**
 * Test patch for MIDI-4 module
 * 4-voice polyphonic MIDI → 4 VCOs → Mixer → VCF → Output
 *
 * Play chords on a MIDI keyboard to hear 4-voice polyphony.
 */
export default {
    "name": "Test: MIDI-4 Poly",
    "factory": true,
    "state": {
        "version": 2,
        "modules": [
            {
                "id": "midi",
                "type": "midi-4",
                "row": 1,
                "index": 0
            },
            {
                "id": "vco1",
                "type": "vco",
                "row": 1,
                "index": 1
            },
            {
                "id": "vco2",
                "type": "vco",
                "row": 1,
                "index": 2
            },
            {
                "id": "vco3",
                "type": "vco",
                "row": 1,
                "index": 3
            },
            {
                "id": "vco4",
                "type": "vco",
                "row": 1,
                "index": 4
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 1,
                "index": 5
            },
            {
                "id": "vcf",
                "type": "vcf",
                "row": 2,
                "index": 6
            },
            {
                "id": "adsr1",
                "type": "adsr",
                "row": 2,
                "index": 7
            },
            {
                "id": "adsr2",
                "type": "adsr",
                "row": 2,
                "index": 8
            },
            {
                "id": "adsr3",
                "type": "adsr",
                "row": 2,
                "index": 9
            },
            {
                "id": "adsr4",
                "type": "adsr",
                "row": 2,
                "index": 10
            },
            {
                "id": "vca",
                "type": "vca",
                "row": 2,
                "index": 11
            },
            {
                "id": "out",
                "type": "out",
                "row": 2,
                "index": 12
            }
        ],
        "params": {
            "midi": {
                "channel": 0,
                "transpose": 0,
                "mode": 0
            },
            "vco1": {
                "coarse": 0.5,
                "fine": 0,
                "pw": 0.5
            },
            "vco2": {
                "coarse": 0.5,
                "fine": 0,
                "pw": 0.5
            },
            "vco3": {
                "coarse": 0.5,
                "fine": 0,
                "pw": 0.5
            },
            "vco4": {
                "coarse": 0.5,
                "fine": 0,
                "pw": 0.5
            },
            "mix": {
                "level1": 0.7,
                "level2": 0.7,
                "level3": 0.7,
                "level4": 0.7
            },
            "vcf": {
                "cutoff": 0.65,
                "resonance": 0.2,
                "env": 0.3
            },
            "adsr1": {
                "attack": 0.02,
                "decay": 0.2,
                "sustain": 0.7,
                "release": 0.4
            },
            "adsr2": {
                "attack": 0.02,
                "decay": 0.2,
                "sustain": 0.7,
                "release": 0.4
            },
            "adsr3": {
                "attack": 0.02,
                "decay": 0.2,
                "sustain": 0.7,
                "release": 0.4
            },
            "adsr4": {
                "attack": 0.02,
                "decay": 0.2,
                "sustain": 0.7,
                "release": 0.4
            },
            "vca": {
                "ch1Level": 0.8,
                "ch2Level": 0
            },
            "out": {
                "levelL": 0.6,
                "levelR": 0.6
            }
        },
        "cables": [
            {
                "fromModule": "midi",
                "fromPort": "pitch1",
                "toModule": "vco1",
                "toPort": "vOct"
            },
            {
                "fromModule": "midi",
                "fromPort": "gate1",
                "toModule": "adsr1",
                "toPort": "gate"
            },
            {
                "fromModule": "midi",
                "fromPort": "pitch2",
                "toModule": "vco2",
                "toPort": "vOct"
            },
            {
                "fromModule": "midi",
                "fromPort": "gate2",
                "toModule": "adsr2",
                "toPort": "gate"
            },
            {
                "fromModule": "midi",
                "fromPort": "pitch3",
                "toModule": "vco3",
                "toPort": "vOct"
            },
            {
                "fromModule": "midi",
                "fromPort": "gate3",
                "toModule": "adsr3",
                "toPort": "gate"
            },
            {
                "fromModule": "midi",
                "fromPort": "pitch4",
                "toModule": "vco4",
                "toPort": "vOct"
            },
            {
                "fromModule": "midi",
                "fromPort": "gate4",
                "toModule": "adsr4",
                "toPort": "gate"
            },
            {
                "fromModule": "vco1",
                "fromPort": "triangle",
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "vco2",
                "fromPort": "triangle",
                "toModule": "mix",
                "toPort": "in2"
            },
            {
                "fromModule": "vco3",
                "fromPort": "triangle",
                "toModule": "mix",
                "toPort": "in3"
            },
            {
                "fromModule": "vco4",
                "fromPort": "triangle",
                "toModule": "mix",
                "toPort": "in4"
            },
            {
                "fromModule": "mix",
                "fromPort": "out",
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
                "fromModule": "adsr1",
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
