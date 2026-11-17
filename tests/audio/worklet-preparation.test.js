import { describe, expect, it, vi } from 'vitest';
import { prepareCoreModules } from '../../src/js/audio/worklet/prepare-modules.js';

describe('core worklet preparation', () => {
    it('prepares a definition once at the context rate without constructing DSP instances', () => {
        const prepareDSP = vi.fn();
        const createDSP = vi.fn();
        prepareCoreModules([{ id: 'prepared', prepareDSP, createDSP }, { id: 'ordinary', createDSP }], 96000);
        expect(prepareDSP).toHaveBeenCalledExactlyOnceWith({ sampleRate: 96000 });
        expect(createDSP).not.toHaveBeenCalled();
    });

    it('propagates preparation failure before registration can continue', () => {
        const later = vi.fn();
        expect(() => prepareCoreModules([
            { id: 'broken', prepareDSP() { throw new Error('asset checksum'); } },
            { id: 'later', prepareDSP: later }
        ], 48000)).toThrow('asset checksum');
        expect(later).not.toHaveBeenCalled();
    });

    it('rejects asynchronous preparation that would race node construction', () => {
        expect(() => prepareCoreModules([
            { id: 'async', prepareDSP: () => Promise.resolve() }
        ], 48000)).toThrow(/async.*synchronous/);
    });

    it('rejects invalid context rates and preparation hooks', () => {
        for (const rate of [0, -1, NaN, Infinity]) {
            expect(() => prepareCoreModules([], rate)).toThrow(/sample rate/);
        }
        expect(() => prepareCoreModules([{ id: 'invalid', prepareDSP: true }], 48000)).toThrow(/invalid.*prepareDSP/);
    });
});
