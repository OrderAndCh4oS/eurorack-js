/**
 * Test - Euclidean Rhythm
 *
 * Demonstrates the Euclidean rhythm generator:
 * - Clock → Euclid → Kick drum
 * - Creates the classic tresillo pattern (3 hits in 8 steps)
 *
 * Try adjusting the knobs:
 * - Hits: Changes how many triggers per cycle
 * - Length: Changes the cycle length
 * - Rotate: Shifts where the pattern starts
 */
export default {
    "name": "Test - Euclidean",
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
                "id": "euclid",
                "type": "euclid",
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
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 3
            }
        ],
        "params": {
            "clk": {
                "rate": 0.4,
                "pause": 0
            },
            "euclid": {
                "length": 8,
                "hits": 3,
                "rotate": 0
            },
            "kick": {
                "pitch": 0.4,
                "decay": 0.4,
                "click": 0.6
            },
            "out": {
                "volume": 0.6
            }
        },
        "cables": [
            {
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "euclid",
                "toPort": "clock"
            },
            {
                "fromModule": "euclid",
                "fromPort": "trig",
                "toModule": "kick",
                "toPort": "trigger"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "kick",
                "fromPort": "out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
