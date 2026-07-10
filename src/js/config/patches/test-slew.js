/**
 * Test - Slew Limiter
 *
 * Demonstrates the slew limiter module for portamento:
 * - SEQ → Slew → VCO pitch (smooth glides between notes)
 * - Clock drives the sequencer
 *
 * Try adjusting the Rate1 knob:
 * - Low values: Fast/snappy transitions
 * - High values: Slow glides between notes
 */
export default {
    "name": "Test - Slew Limiter",
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
                "id": "slew",
                "type": "slew",
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
                "id": "vca",
                "type": "vca",
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
                "rate": 0.4
            },
            "seq": {
                "step1": 0,
                "step2": 0.25,
                "step3": 0.5,
                "step4": 0.75,
                "step5": 1,
                "step6": 0.75,
                "step7": 0.5,
                "step8": 0.25,
                "length": 8,
                "range": 1,
                "direction": 0
            },
            "slew": {
                "rate1": 0.15,
                "rate2": 0.1
            },
            "vco": {
                "coarse": 0.35,
                "fine": 0,
                "glide": 0
            },
            "vca": {
                "ch1Gain": 0.8,
                "ch2Gain": 0.8
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
                "toModule": "slew",
                "toPort": "in1"
            },
            {
                "fromModule": "slew",
                "fromPort": "out1",
                "toModule": "vco",
                "toPort": "vOct"
            },
            {
                "fromModule": "vco",
                "fromPort": "triangle",
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
