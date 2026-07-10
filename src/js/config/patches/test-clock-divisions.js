/**
 * Test - Clock Divisions
 * Demonstrates clock divider with drum sounds
 *
 * Kick triggers on /4 division (every 4 beats)
 * Hat triggers on x2 multiplication (twice per beat)
 * This makes the rhythmic relationship clearly audible
 */
export default {
    "name": "Test - Clock Divisions",
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
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 5
            }
        ],
        "params": {
            "clk": {
                "rate": 0.353,
                "pause": 0
            },
            "div": {
                "rate1": 0.337,
                "rate2": 0.529
            },
            "kick": {
                "pitch": 0.3,
                "decay": 0.5,
                "tone": 0.4,
                "click": 0.5
            },
            "hat": {
                "decay": 0.3,
                "sizzle": 0.5,
                "blend": 0.5
            },
            "mix": {
                "lvl1": 0.8,
                "lvl2": 0.5,
                "lvl3": 0.8,
                "lvl4": 0.8
            },
            "out": {
                "volume": 0.6
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
                "fromPort": "out1",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "div",
                "fromPort": "out2",
                "toModule": "hat",
                "toPort": "trigClosed"
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
