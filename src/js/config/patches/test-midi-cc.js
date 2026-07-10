/**
 * Test patch for MIDI-CC module
 * Use MIDI CC knobs to control synth parameters in real-time.
 *
 * Default mappings:
 * - CC1 (Mod wheel) → VCF Cutoff
 * - CC7 (Volume) → VCA Level
 * - CC74 (Brightness) → VCO FM amount
 * - CC71 (Resonance) → VCF Resonance
 *
 * Use with the midi-controller.html dashboard or a hardware controller.
 */
export default {
    "name": "Test: MIDI-CC",
    "factory": true,
    "state": {
        "version": 3,
        "plugins": { "core": 1 },
        "modules": [
            {
                "id": "midi",
                "type": "midi-cv",
                "row": 1,
                "index": 0
            },
            {
                "id": "cc",
                "type": "midi-cc",
                "row": 1,
                "index": 1
            },
            {
                "id": "lfo",
                "type": "lfo",
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
                "id": "adsr",
                "type": "adsr",
                "row": 1,
                "index": 5
            },
            {
                "id": "vca",
                "type": "vca",
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
            "midi": {
                "channel": 0,
                "transpose": 0,
                "bendRange": 2
            },
            "cc": {
                "channel": 0,
                "cc1": 1,
                "cc2": 7,
                "cc3": 74,
                "cc4": 71
            },
            "lfo": {
                "rateKnob": 0.4,
                "waveKnob": 0
            },
            "vco": {
                "coarse": 0.5,
                "fine": 0
            },
            "vcf": {
                "cutoff": 0.5,
                "resonance": 0.3
            },
            "adsr": {
                "attack": 0.05,
                "decay": 0.3,
                "sustain": 0.6,
                "release": 0.3
            },
            "vca": {
                "ch1Gain": 0.7,
                "ch2Gain": 0
            },
            "out": {
                "volume": 0.7
            }
        },
        "cables": [
            {
                "fromModule": "midi",
                "fromPort": "pitch",
                "toModule": "vco",
                "toPort": "vOct"
            },
            {
                "fromModule": "midi",
                "fromPort": "gate",
                "toModule": "adsr",
                "toPort": "gate"
            },
            {
                "fromModule": "cc",
                "fromPort": "cv1",
                "toModule": "vcf",
                "toPort": "cutoffCV"
            },
            {
                "fromModule": "cc",
                "fromPort": "cv3",
                "toModule": "vco",
                "toPort": "fm"
            },
            {
                "fromModule": "cc",
                "fromPort": "cv4",
                "toModule": "vcf",
                "toPort": "resCV"
            },
            {
                "fromModule": "lfo",
                "fromPort": "primary",
                "toModule": "vco",
                "toPort": "pwm"
            },
            {
                "fromModule": "vco",
                "fromPort": "pulse",
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
