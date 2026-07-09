/**
 * Test - Function Generator LFO
 *
 * Demonstrates FUNC as a complex LFO:
 * - Cycle mode creates continuous waveform
 * - Rise/Fall create asymmetric shapes
 * - Curve morphs between triangle/saw/exp
 *
 * Try: Equal Rise/Fall for triangle,
 * Fast Rise + Slow Fall for ramp down,
 * Slow Rise + Fast Fall for ramp up.
 */
export default {
    "name": "Test - Func LFO",
    "factory": true,
    "state": {
        "version": 2,
        "modules": [
            {
                "id": "func",
                "type": "func",
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
                "id": "vcf",
                "type": "vcf",
                "row": 1,
                "index": 2
            },
            {
                "id": "vca",
                "type": "vca",
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
            "func": {
                "rise": 0.3267,
                "fall": 0.64,
                "curve": 0.5,
                "cycle": 1
            },
            "vco": {
                "coarse": 0.3067,
                "fine": 0,
                "glide": 5
            },
            "vcf": {
                "cutoff": 0.4,
                "resonance": 0.5
            },
            "vca": {
                "ch1Gain": 1,
                "ch2Gain": 0.8
            },
            "mix": {
                "lvl1": 0.8,
                "lvl2": 0.8,
                "lvl3": 0.8,
                "lvl4": 0.8
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "func",
                "fromPort": "out",
                "toModule": "vcf",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "vco",
                "fromPort": "ramp",
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
                "fromModule": "vca",
                "fromPort": "ch1Out",
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
