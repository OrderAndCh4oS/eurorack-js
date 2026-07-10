/**
 * Drums - Punchy Kick
 * Focused kick drum with LFO modulation
 */
export default {
    "name": "Drums - Punchy Kick",
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
                "id": "lfo",
                "type": "lfo",
                "row": 1,
                "index": 1
            },
            {
                "id": "kick",
                "type": "kick",
                "row": 1,
                "index": 2
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 1,
                "index": 3
            },
            {
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 4
            }
        ],
        "params": {
            "clk": {
                "rate": 0.32
            },
            "lfo": {
                "rateKnob": 0.2,
                "waveKnob": 0.5,
                "range": 0
            },
            "kick": {
                "pitch": 0.35,
                "decay": 0.55,
                "tone": 0.5
            },
            "mix": {
                "lvl1": 1,
                "lvl2": 0,
                "lvl3": 0,
                "lvl4": 0
            },
            "out": {
                "volume": 0.7
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "kick",
                "toPort": "toneCV"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "mix",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "mix",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
