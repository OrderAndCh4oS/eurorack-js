/**
 * Test - Quad LFO
 *
 * Shows quadrature phase movement on the scope while out0 sweeps filter
 * cutoff and out90 opens the VCA for phase-related motion.
 */
export default {
    "name": "Test - Quad LFO",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "quad",
                "type": "quad-lfo",
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
            "quad": {
                "rate": 0.42,
                "range": 0,
                "rateCvAmt": 0
            },
            "vco": {
                "coarse": 0.36,
                "fine": 0,
                "glide": 5
            },
            "vcf": {
                "cutoff": 0.34,
                "resonance": 0.38
            },
            "vca": {
                "ch1Gain": 0.85,
                "ch2Gain": 0
            },
            "scope": {
                "time": 0.45,
                "gain1": 0.5,
                "gain2": 0.5,
                "offset1": 0.5,
                "offset2": 0.5,
                "trigger": 0.5,
                "mode": 1
            },
            "out": {
                "volume": 0.5
            }
        },
        "cables": [
            {
                "fromModule": "quad",
                "fromPort": "out0",
                "toModule": "vcf",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "quad",
                "fromPort": "out90",
                "toModule": "vca",
                "toPort": "ch1CV"
            },
            {
                "fromModule": "quad",
                "fromPort": "out0",
                "toModule": "scope",
                "toPort": "in1"
            },
            {
                "fromModule": "quad",
                "fromPort": "out90",
                "toModule": "scope",
                "toPort": "in2"
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
                "toModule": "out",
                "toPort": "L"
            },
            {
                "fromModule": "vca",
                "fromPort": "ch1Out",
                "toModule": "out",
                "toPort": "R"
            }
        ],
        "midiMappings": {}
    }
};
