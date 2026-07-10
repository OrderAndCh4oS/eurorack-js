/**
 * Test - Wavefolder
 *
 * Demonstrates wavefolding:
 * - VCO triangle wave through wavefolder
 * - LFO modulates fold amount for evolving timbre
 *
 * Try adjusting the Fold knob to hear the harmonics change.
 */
export default {
    "name": "Test - Fold",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "lfo",
                "type": "lfo",
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
                "id": "fold",
                "type": "fold",
                "row": 1,
                "index": 2
            },
            {
                "id": "vcf",
                "type": "vcf",
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
            "lfo": {
                "rate": 0.25,
                "shape": 0.5,
                "range": 0
            },
            "vco": {
                "coarse": 0.35,
                "fine": 0
            },
            "fold": {
                "fold": 0.4,
                "sym": 0
            },
            "vcf": {
                "cutoff": 0.6,
                "res": 0.3
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "fold",
                "toPort": "foldCV"
            },
            {
                "fromModule": "vco",
                "fromPort": "triangle",
                "toModule": "fold",
                "toPort": "audio"
            },
            {
                "fromModule": "fold",
                "fromPort": "out",
                "toModule": "vcf",
                "toPort": "audio"
            },
            {
                "fromModule": "vcf",
                "fromPort": "lpf",
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "vcf",
                "fromPort": "lpf",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
