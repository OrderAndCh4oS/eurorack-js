/**
 * Test patch for MIDI-CLK module
 * Sync a sequencer to MIDI clock from your DAW.
 *
 * 1. Set your DAW to send MIDI clock
 * 2. Press play in your DAW
 * 3. The sequencer will sync to your DAW's tempo
 */
export default {
    "name": "Test: MIDI-CLK",
    "factory": true,
    "state": {
        "version": 2,
        "modules": [
            {
                "id": "clk",
                "type": "midi-clk",
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
                "id": "vco",
                "type": "vco",
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
                "id": "adsr",
                "type": "adsr",
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
                "id": "out",
                "type": "out",
                "row": 1,
                "index": 6
            }
        ],
        "params": {
            "clk": {
                "division": 4
            },
            "seq": {
                "step1": 0.5,
                "step2": 0.6,
                "step3": 0.4,
                "step4": 0.7,
                "step5": 0.5,
                "step6": 0.3,
                "step7": 0.6,
                "step8": 0.4,
                "length": 8,
                "range": 1,
                "direction": 0,
                "gate1": 1,
                "gate2": 1,
                "gate3": 1,
                "gate4": 1,
                "gate5": 1,
                "gate6": 0,
                "gate7": 1,
                "gate8": 1
            },
            "vco": {
                "coarse": 0.4,
                "fine": 0,
                "pw": 0.5
            },
            "vcf": {
                "cutoff": 0.55,
                "resonance": 0.4,
                "env": 0.4
            },
            "adsr": {
                "attack": 0.01,
                "decay": 0.15,
                "sustain": 0.3,
                "release": 0.2
            },
            "vca": {
                "ch1Level": 0.8,
                "ch2Level": 0
            },
            "out": {
                "levelL": 0.7,
                "levelR": 0.7
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
                "fromModule": "clk",
                "fromPort": "reset",
                "toModule": "seq",
                "toPort": "reset"
            },
            {
                "fromModule": "seq",
                "fromPort": "cv",
                "toModule": "vco",
                "toPort": "vOct"
            },
            {
                "fromModule": "seq",
                "fromPort": "gate",
                "toModule": "adsr",
                "toPort": "gate"
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
                "fromModule": "adsr",
                "fromPort": "env",
                "toModule": "vca",
                "toPort": "ch1CV"
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
