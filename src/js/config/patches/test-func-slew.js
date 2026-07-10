/**
 * Test - Function Generator Slew
 *
 * Demonstrates FUNC as a slew limiter / portamento:
 * - Sequencer CV goes through FUNC
 * - FUNC smooths the steps into glides
 * - Rise = glide up speed, Fall = glide down speed
 *
 * Try: Equal Rise/Fall for symmetric glide,
 * or different values for asymmetric portamento.
 */
export default {
    "name": "Test - Func Slew",
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
                "id": "seq",
                "type": "seq",
                "row": 1,
                "index": 1
            },
            {
                "id": "func",
                "type": "func",
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
                "id": "vca",
                "type": "vca",
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
                "rate": 0.35,
                "pause": 0
            },
            "seq": {
                "step1": 0.2,
                "step2": 0.5,
                "step3": 0.3,
                "step4": 0.7,
                "step5": 0.4,
                "step6": 0.6,
                "step7": 0.35,
                "step8": 0.8,
                "length": 8,
                "range": 1,
                "direction": 0,
                "gate1": 1,
                "gate2": 1,
                "gate3": 1,
                "gate4": 1,
                "gate5": 1,
                "gate6": 1,
                "gate7": 1,
                "gate8": 1
            },
            "func": {
                "rise": 0.3833,
                "fall": 0.62,
                "curve": 0.3,
                "cycle": 0
            },
            "vco": {
                "coarse": 0.35,
                "fine": 0,
                "glide": 0
            },
            "vcf": {
                "cutoff": 0.6,
                "resonance": 0.3
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
                "fromModule": "clk",
                "fromPort": "clock",
                "toModule": "seq",
                "toPort": "clock"
            },
            {
                "fromModule": "seq",
                "fromPort": "cv",
                "toModule": "func",
                "toPort": "in"
            },
            {
                "fromModule": "func",
                "fromPort": "out",
                "toModule": "vco",
                "toPort": "vOct"
            },
            {
                "fromModule": "vco",
                "fromPort": "triangle",
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
