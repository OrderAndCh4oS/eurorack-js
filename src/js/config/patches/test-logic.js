/**
 * Test - Logic Gates
 *
 * Demonstrates AND/OR logic operations:
 * - Two euclidean patterns feed into Logic
 * - AND output triggers kick (only when both patterns hit)
 * - OR output triggers snare (when either pattern hits)
 *
 * Try adjusting the euclidean patterns to hear different rhythms.
 */
export default {
    "name": "Test - Logic",
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
                "id": "euclid1",
                "type": "euclid",
                "row": 1,
                "index": 1
            },
            {
                "id": "euclid2",
                "type": "euclid",
                "row": 1,
                "index": 2
            },
            {
                "id": "logic",
                "type": "logic",
                "row": 1,
                "index": 3
            },
            {
                "id": "kick",
                "type": "kick",
                "row": 1,
                "index": 4
            },
            {
                "id": "snare",
                "type": "snare",
                "row": 1,
                "index": 5
            },
            {
                "id": "mix",
                "type": "mix",
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
                "bpm": 0.35
            },
            "euclid1": {
                "length": 8,
                "hits": 5,
                "rotate": 0
            },
            "euclid2": {
                "length": 8,
                "hits": 3,
                "rotate": 0
            },
            "kick": {
                "tune": 0.4,
                "decay": 0.4,
                "punch": 0.6
            },
            "snare": {
                "tune": 0.5,
                "decay": 0.3,
                "noise": 0.6
            },
            "mix": {
                "lvl1": 0.7,
                "lvl2": 0.5
            },
            "out": {
                "volume": 0.6
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "euclid1",
                "toPort": "clock"
            },
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "euclid2",
                "toPort": "clock"
            },
            {
                "fromModule": "euclid1",
                "fromPort": "trig",
                "toModule": "logic",
                "toPort": "in1"
            },
            {
                "fromModule": "euclid2",
                "fromPort": "trig",
                "toModule": "logic",
                "toPort": "in2"
            },
            {
                "fromModule": "logic",
                "fromPort": "and",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "logic",
                "fromPort": "or",
                "toModule": "snare",
                "toPort": "trigger"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "mix",
                "toPort": "in1"
            },
            {
                "fromModule": "snare",
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
