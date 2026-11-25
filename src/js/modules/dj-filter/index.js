import { clamp } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';
import { softLimitVoltage } from '../../utils/voltage.js';

const controls = [
    ['sweep', 'Sweep', -1], ['resonance', 'Res', 0], ['tilt', 'Tilt', -1],
    ['lpAmount', 'LP CV', -1], ['hpAmount', 'HP CV', -1]
];
const inputPorts = [
    ['inL', 'L', 'audio'], ['inR', 'R', 'audio'], ['masterCV', 'Master', 'cv'],
    ['lpCV', 'LP', 'cv'], ['hpCV', 'HP', 'cv'], ['tiltCV', 'Tilt', 'cv'], ['resCV', 'Res', 'cv']
];
const finite = value => Number.isFinite(value) ? value : 0;

// Trapezoidal SVF with separate state per stage and per stereo side (Simper).
function createStage(sampleRate, highpass) {
    let ic1 = 0, ic2 = 0;
    let lastDepth = -1, lastTilt = 0, lastDamping = 0, lastLimit = false;
    let a1 = 0, a2 = 0, a3 = 0;
    const ceiling = Math.min(18000, sampleRate * 0.45);
    const floor = Math.min(20, ceiling);
    return {
        process(input, depth, tilt, damping, limited) {
            if (depth < 1e-6) {
                ic1 = 0;
                ic2 = highpass ? 0 : input;
                return input;
            }
            if (depth !== lastDepth || tilt !== lastTilt || damping !== lastDamping || limited !== lastLimit) {
                const low = highpass || !limited ? floor : Math.min(220, ceiling);
                const high = highpass && limited ? Math.min(2000, ceiling) : ceiling;
                const travel = highpass ? depth : 1 - depth;
                const frequency = low * (high / low) ** travel * 2 ** tilt;
                const g = Math.tan(Math.PI * clamp(frequency, floor, ceiling) / sampleRate);
                a1 = 1 / (1 + g * (g + damping));
                a2 = g * a1;
                a3 = g * a2;
                lastDepth = depth;
                lastTilt = tilt;
                lastDamping = damping;
                lastLimit = limited;
            }
            const v3 = input - ic2;
            const band = a1 * ic1 + a2 * v3;
            const low = ic2 + a2 * ic1 + a3 * v3;
            ic1 = 2 * band - ic1;
            ic2 = 2 * low - ic2;
            const wet = highpass ? input - damping * band - low : low;
            return input + Math.min(1, depth * 16) * (wet - input);
        },
        reset() { ic1 = ic2 = 0; }
    };
}

export default {
    id: 'dj-filter',
    name: 'DJ FILTER',
    hp: 12,
    color: 'module-color-ten',
    category: 'filter',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const inputs = Object.fromEntries(inputPorts.map(([id]) => [id, new Float32Array(bufferSize)]));
        const outL = new Float32Array(bufferSize), outR = new Float32Array(bufferSize);
        const params = { sweep: 0, resonance: 0, tilt: 0, lpAmount: 0, hpAmount: 0, limit: 1, tiltRoute: 1, offset: 0, bypass: 0 };
        const leds = { active: 1 };
        const lpL = createStage(sampleRate, false), lpR = createStage(sampleRate, false);
        const hpL = createStage(sampleRate, true), hpR = createStage(sampleRate, true);
        const panel = Object.fromEntries(controls.map(([key]) => [key, createSlew({ sampleRate, timeMs: 2 })]));
        const connected = { inR: false, lpCV: false, hpCV: false };
        const bypassStep = 1 / (sampleRate * 0.003);
        let mix = 1;
        let firstBlock = true;

        function restoreControls() {
            for (const [key] of controls) panel[key].reset(finite(params[key]));
            mix = params.bypass === 1 ? 0 : 1;
            firstBlock = false;
        }

        return {
            inputs, outputs: { outL, outR }, params, leds,
            onInputConnected(port) { if (Object.hasOwn(connected, port)) connected[port] = true; },
            onInputDisconnected(port) { if (Object.hasOwn(connected, port)) connected[port] = false; },
            process() {
                if (firstBlock) restoreControls();
                const { sweep, resonance, tilt, lpAmount, hpAmount, tiltRoute, limit, offset, bypass } = params;
                const limited = limit === 1;
                const target = bypass === 1 ? 0 : 1;
                const bias = offset === 1 ? 5 : 0;
                for (let i = 0; i < bufferSize; i++) {
                    const dryL = clamp(finite(inputs.inL[i]), -5, 5);
                    const dryR = connected.inR ? clamp(finite(inputs.inR[i]), -5, 5) : dryL;
                    const master = clamp(panel.sweep.process(finite(sweep)) + finite(inputs.masterCV[i]) / 5, -1, 1);
                    const stereo = clamp(panel.tilt.process(finite(tilt)) + finite(inputs.tiltCV[i]) / 5, -1, 1);
                    const res = clamp(panel.resonance.process(finite(resonance)) + finite(inputs.resCV[i]) / 5);
                    const damping = 1 / (Math.SQRT1_2 + (3.5 - Math.SQRT1_2) * res);
                    const lpMod = connected.lpCV ? finite(inputs.lpCV[i]) : bias;
                    const hpMod = connected.hpCV ? finite(inputs.hpCV[i]) : bias;
                    const lp = clamp(Math.max(0, -master) - panel.lpAmount.process(finite(lpAmount)) * lpMod / 5);
                    const hp = clamp(Math.max(0, master) + panel.hpAmount.process(finite(hpAmount)) * hpMod / 5);
                    const lpTilt = tiltRoute === 2 ? 0 : stereo;
                    const hpTilt = tiltRoute === 0 ? 0 : stereo;
                    const wetL = hpL.process(lpL.process(dryL, lp, lpTilt, damping, limited), hp, hpTilt, damping, limited);
                    const wetR = hpR.process(lpR.process(dryR, lp, -lpTilt, damping, limited), hp, -hpTilt, damping, limited);
                    mix += clamp(target - mix, -bypassStep, bypassStep);
                    if (mix === 0 || (lp < 1e-6 && hp < 1e-6)) {
                        outL[i] = dryL;
                        outR[i] = dryR;
                    } else {
                        outL[i] = dryL + mix * (softLimitVoltage(wetL, 5) - dryL);
                        outR[i] = dryR + mix * (softLimitVoltage(wetR, 5) - dryR);
                    }
                }
                leds.active = target;
            },
            reset() {
                for (const buffer of Object.values(inputs)) buffer.fill(0);
                outL.fill(0);
                outR.fill(0);
                for (const stage of [lpL, hpL, lpR, hpR]) stage.reset();
                restoreControls();
                leds.active = mix;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: controls.map(([id, label, min]) => ({ id, param: id, label, min, max: 1, default: 0, small: id !== 'sweep' })),
        switches: [
            { id: 'limit', param: 'limit', label: 'Range', positions: ['Full', 'Limit'], default: 1 },
            { id: 'tiltRoute', param: 'tiltRoute', label: 'Tilt to', positions: ['LP', 'Both', 'HP'], default: 1 },
            { id: 'offset', param: 'offset', label: 'Bias', positions: ['CV', '+5 V'], default: 0 }
        ],
        actions: [{ id: 'bypass', param: 'bypass', label: 'Bypass', mode: 'toggle', default: 0 }],
        inputs: inputPorts.map(([id, label, signal]) => ({ id, port: id, label, signal })),
        outputs: ['L', 'R'].map(label => ({ id: 'out' + label, port: 'out' + label, label, signal: 'audio' })),
        socketLayout: { columns: [
            { label: 'In', ports: ['inL', 'inR'] },
            { label: 'Modulation', columns: 3, ports: ['masterCV', 'lpCV', 'hpCV', 'tiltCV', 'resCV'] },
            { label: 'Out', ports: ['outL', 'outR'] }
        ] }
    }
};
