/**
 * Test - Burst
 *
 * Clock pings and triggers Burst, which creates ratcheted kick hits.
 * EOC taps the closed hat and the tempo/burst trigger streams are scoped.
 */
export default {
    "name": "Test - Burst",
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
                "id": "burst",
                "type": "burst",
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
                "id": "hat",
                "type": "hat",
                "row": 1,
                "index": 3
            },
            {
                "id": "mix",
                "type": "mix",
                "row": 1,
                "index": 4
            },
            {
                "id": "scope",
                "type": "scope",
                "row": 2,
                "index": 0
            },
            {
                "id": "out",
                "type": "out",
                "row": 2,
                "index": 1
            }
        ],
        "params": {
            "clk": {
                "rate": 0.31,
                "pause": 0
            },
            "burst": {
                "tempo": 120,
                "quantity": 5,
                "quantityCvAmount": 1,
                "distribution": 0.35,
                "timeFactor": -2,
                "probability": 1,
                "cycle": 0,
                "includeFirstPulse": 1,
                "retrigger": 1
            },
            "kick": {
                "pitch": 0.28,
                "decay": 0.35,
                "tone": 0.35,
                "click": 0.55
            },
            "hat": {
                "decay": 0.2,
                "sizzle": 0.6,
                "blend": 0.5
            },
            "mix": {
                "lvl1": 0.85,
                "lvl2": 0.32,
                "lvl3": 0,
                "lvl4": 0
            },
            "scope": {
                "time": 0.32,
                "gain1": 0.5,
                "gain2": 0.5,
                "offset1": 0.5,
                "offset2": 0.5,
                "trigger": 0.55,
                "mode": 0
            },
            "out": {
                "volume": 0.55
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "burst",
                "toPort": "ping"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "burst",
                "toPort": "trig"
            },
            {
                "fromModule": "burst",
                "fromPort": "out",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "burst",
                "fromPort": "eoc",
                "toModule": "hat",
                "toPort": "trigClosed"
            },
            {
                "fromModule": "burst",
                "fromPort": "tempo",
                "toModule": "scope",
                "toPort": "in1"
            },
            {
                "fromModule": "burst",
                "fromPort": "out",
                "toModule": "scope",
                "toPort": "in2"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "hat",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in2"
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
