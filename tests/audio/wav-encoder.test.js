import { describe, expect, it } from 'vitest';
import { encodeWav } from '../../src/js/audio/wav-encoder.js';

describe('WAV encoder', () => {
    it('encodes only the valid samples from a padded final chunk', async () => {
        const left = new Float32Array(8).fill(5);
        const right = new Float32Array(8).fill(-5);
        const blob = encodeWav([left], [right], 48000, 3);
        const arrayBuffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(blob);
        });
        const view = new DataView(arrayBuffer);

        expect(view.getUint32(40, true)).toBe(12);
        expect(view.byteLength).toBe(56);
        expect(view.getInt16(44, true)).toBe(0x7fff);
        expect(view.getInt16(46, true)).toBe(-0x7fff);
    });
});
