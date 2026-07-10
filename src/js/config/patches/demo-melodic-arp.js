/**
 * Demo - Melodic Arp
 * Melodic arpeggiator patch with modulation
 */
export default {
    "name": "Demo - Melodic Arp",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "arp",
                "type": "arp",
                "row": 1,
                "index": 0
            },
            {
                "id": "vco",
                "type": "vco",
                "row": 1,
                "index": 1
            },
            {
                "id": "clk",
                "type": "clk",
                "row": 1,
                "index": 2
            },
            {
                "id": "lfo",
                "type": "lfo",
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
            "clk": {
                "rate": 0.32333333333333336,
                "pause": 0
            },
            "lfo": {
                "rateKnob": 0.6933333333333334,
                "waveKnob": 0.8066666666666666,
                "range": 0
            },
            "arp": {
                "root": 4,
                "chord": 8,
                "mode": 1,
                "octaves": 0
            },
            "vco": {
                "coarse": 0.3466666666666666,
                "fine": 0.15999999999999964,
                "glide": 21.333333333333332
            },
            "adsr": {
                "attack": 0,
                "decay": 0.38,
                "sustain": 0.2566666666666667,
                "release": 0.7133333333333333
            },
            "vca": {
                "ch1Gain": 0.7,
                "ch2Gain": 0.27
            },
            "out": {
                "volume": 0.67
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "arp",
                "toPort": "trigger"
            },
            {
                "fromModule": "arp",
                "fromPort": "cv",
                "toModule": "vco",
                "toPort": "vOct"
            },
            {
                "fromModule": "arp",
                "fromPort": "gate",
                "toModule": "adsr",
                "toPort": "gate"
            },
            {
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vca",
                "toPort": "ch2CV"
            },
            {
                "fromModule": "lfo",
                "fromPort": "secondary",
                "toModule": "vco",
                "toPort": "pwm"
            },
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "vca",
                "toPort": "ch1In"
            },
            {
                "fromModule": "vco",
                "fromPort": "pulse",
                "toModule": "vca",
                "toPort": "ch2In"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
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
