import { describe, expect, it } from 'vitest';
import {
    clamp,
    createLinearCircularReader,
    createRealFft,
    createSlew,
    expMap,
    linearInterpolate,
    polyBlep,
    softLimitVoltage,
    wrapPhase
} from '../../src/js/index.js';

describe('public DSP utility exports', () => {
    it('exports every supported module-authoring primitive', () => {
        [
            clamp,
            createLinearCircularReader,
            createRealFft,
            createSlew,
            expMap,
            linearInterpolate,
            polyBlep,
            softLimitVoltage,
            wrapPhase
        ].forEach(utility => expect(utility).toBeTypeOf('function'));
    });
});
