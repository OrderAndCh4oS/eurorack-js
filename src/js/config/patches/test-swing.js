/**
 * Test - Swing
 *
 * Compares the straight reclocked output with the swung clock output.
 * Straight drives the kick, swung clock drives the closed hat, and both
 * clocks are visible on the scope.
 */
export default {
    "name": "Test - Swing",
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
                "id": "swing",
                "type": "swing",
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
                "rate": 0.34,
                "pause": 0
            },
            "swing": {
                "swing": 0.68,
                "human": 0.12,
                "width": 0.08,
                "template": 2
            },
            "kick": {
                "pitch": 0.28,
                "decay": 0.42,
                "tone": 0.35,
                "click": 0.45
            },
            "hat": {
                "decay": 0.24,
                "sizzle": 0.62,
                "blend": 0.55
            },
            "mix": {
                "lvl1": 0.85,
                "lvl2": 0.45,
                "lvl3": 0,
                "lvl4": 0
            },
            "scope": {
                "time": 0.38,
                "gain1": 0.5,
                "gain2": 0.5,
                "offset1": 0.5,
                "offset2": 0.5,
                "trigger": 0.5,
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
                "toModule": "swing",
                "toPort": "clock"
            },
            {
                "fromModule": "swing",
                "fromPort": "straight",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "swing",
                "fromPort": "swung",
                "toModule": "hat",
                "toPort": "trigClosed"
            },
            {
                "fromModule": "swing",
                "fromPort": "straight",
                "toModule": "scope",
                "toPort": "in1"
            },
            {
                "fromModule": "swing",
                "fromPort": "swung",
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
