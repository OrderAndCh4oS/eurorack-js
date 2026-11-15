// Original introduction patch. Design and source references:
// research/compositions/introduction-demo.md
const row = (number, entries) => entries.map(([id, type], index) => ({ id, type, row: number, index }));
const cable = (from, to) => {
    const [fromModule, fromPort] = from.split('.');
    const [toModule, toPort] = to.split('.');
    return { fromModule, fromPort, toModule, toPort };
};

export default {
    name: 'Introduction',
    factory: true,
    description: 'A seven-note plucked melody, pulsing bass and light drums, with slowly changing tone and stereo reverb.',
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            ...row(1, [
                ['clock', 'clk'], ['divide', 'div'], ['melody', 'seq'], ['strings', 'pluck'],
                ['width', 'chorus'], ['room', 'verb'], ['left', 'mix'], ['right', 'mix'], ['main', 'out']
            ]),
            ...row(2, [
                ['roots', 'seq'], ['bass', 'vco'], ['tone', 'vcf'], ['shape', 'func'],
                ['level', 'vca'], ['depth', 'atten'], ['motion', 'lfo'], ['kick', 'kick'], ['hat', 'hat']
            ])
        ],
        params: {
            // Approximately 96 BPM with one clock pulse per eighth note.
            clock: { rate: 0.301, pause: 0 },
            divide: { rate1: 0.438, rate2: 0.063 }, // /2 beat; /8 bar.
            // SEQ advances before playing its first clocked note. These values
            // therefore start with A4, C5, E5, G5, E5, D5, C5 at step 2.
            melody: { step1: 0.25, step2: 0, step3: 0.25, step4: 0.583,
                step5: 0.833, step6: 0.583, step7: 0.417,
                length: 7, range: 0, direction: 0 },
            strings: { pitch: 0.6, decay: 0.65, damp: 0.64, position: 0.29 },
            width: { rate: 0.09, depth: 0.14, mix: 0.24 },
            room: { time: 0.48, damp: 0.64, mix: 0.23 },
            left: { lvl1: 0.95, lvl2: 0.18, lvl3: 0.19, lvl4: 0.09 },
            right: { lvl1: 0.95, lvl2: 0.18, lvl3: 0.19, lvl4: 0.12 },
            main: { volume: 1 },
            // F2 base with A2, F2, C3, G2 roots. Initial A2 is already
            // available when the first beat arrives; roots move every bar.
            roots: { step1: 0.333, step2: 0, step3: 0.583, step4: 0.167,
                length: 4, range: 0, direction: 0 },
            bass: { coarse: 0.353, fine: -0.067, glide: 14 },
            tone: { cutoff: 0.34, resonance: 0.23 },
            // A triggered rise/fall completes even after DIV's short pulse.
            shape: { rise: 0.181, fall: 0.686, curve: 0.3, cycle: 0 },
            level: { ch1Gain: 0.78, ch2Gain: 0 },
            // 0–10V function -> 0–5V VCA/filter CV; unipolar LFO -> ±0.4V.
            depth: { atten1: 0.75, offset1: 0.5, atten2: 0.58, offset2: 0.46 },
            motion: { rateKnob: 0.11, waveKnob: 0, range: 0 },
            kick: { pitch: 0.208, decay: 0.29, tone: 0.14, click: 0.19 },
            hat: { decay: 0.15, sizzle: 0.35, blend: 0.58 }
        },
        cables: [
            ['clock.clock', 'divide.clock'],
            ['clock.clock', 'melody.clock'],
            ['clock.clock', 'hat.trigClosed'],
            ['divide.out1', 'shape.trig'],
            ['divide.out1', 'kick.trigger'],
            ['divide.out2', 'roots.clock'],
            ['melody.cv', 'strings.vOct'],
            ['melody.gate', 'strings.trigger'],
            ['roots.cv', 'bass.vOct'],
            ['bass.ramp', 'tone.audio'],
            ['tone.lpf', 'level.ch1In'],
            ['shape.out', 'depth.in1'],
            ['depth.out1', 'level.ch1CV'],
            ['depth.out1', 'tone.cutoffCV'],
            ['motion.primary', 'depth.in2'],
            ['depth.out2', 'strings.dampCV'],
            ['depth.out2', 'strings.positionCV'],
            ['depth.out2', 'strings.decayCV'],
            ['strings.out', 'width.inL'],
            ['width.outL', 'room.audioL'],
            ['width.outR', 'room.audioR'],
            ['room.outL', 'left.in1'],
            ['room.outR', 'right.in1'],
            ['level.ch1Out', 'left.in2'],
            ['level.ch1Out', 'right.in2'],
            ['kick.out', 'left.in3'],
            ['kick.out', 'right.in3'],
            ['hat.out', 'left.in4'],
            ['hat.out', 'right.in4'],
            ['left.out', 'main.L'],
            ['right.out', 'main.R']
        ].map(([from, to]) => cable(from, to)),
        midiMappings: {}
    }
};
