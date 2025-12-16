/**
 * Kick Consistency Test
 * Verifies that multiple kick hits produce identical waveforms
 */
import { describe, it, expect, beforeEach } from 'vitest';
import kickModule from '../../src/js/modules/kick/index.js';

describe('Kick Consistency', () => {
    const sampleRate = 44100;
    const bufferSize = 512;
    let kick;

    beforeEach(() => {
        kick = kickModule.createDSP({ sampleRate, bufferSize });
    });

    it('should produce identical waveforms for consecutive triggers', () => {
        // Capture multiple kick waveforms
        const waveforms = [];
        const samplesPerKick = 4096; // ~93ms at 44100Hz

        for (let hit = 0; hit < 5; hit++) {
            const waveform = [];

            // Trigger the kick
            kick.inputs.trigger[0] = 10;
            kick.inputs.trigger.fill(0, 1);

            // Capture the waveform over multiple buffers
            let samplesCollected = 0;
            while (samplesCollected < samplesPerKick) {
                kick.process();

                for (let i = 0; i < bufferSize && samplesCollected < samplesPerKick; i++) {
                    waveform.push(kick.outputs.out[i]);
                    samplesCollected++;
                }

                // Clear trigger for subsequent buffers
                kick.inputs.trigger.fill(0);
            }

            waveforms.push(waveform);

            // Let the kick fully decay before next trigger
            for (let i = 0; i < 20; i++) {
                kick.process();
            }
        }

        // Compare all waveforms to the first one
        const reference = waveforms[0];

        for (let hit = 1; hit < waveforms.length; hit++) {
            const current = waveforms[hit];

            // Check each sample matches exactly
            let maxDiff = 0;
            let diffIndex = -1;

            for (let i = 0; i < reference.length; i++) {
                const diff = Math.abs(reference[i] - current[i]);
                if (diff > maxDiff) {
                    maxDiff = diff;
                    diffIndex = i;
                }
            }

            // Report any differences
            if (maxDiff > 0) {
                console.log(`Hit ${hit} max diff: ${maxDiff} at sample ${diffIndex}`);
                console.log(`  Reference: ${reference[diffIndex]}`);
                console.log(`  Current: ${current[diffIndex]}`);
            }

            // Waveforms should be identical (within floating point tolerance)
            expect(maxDiff).toBeLessThan(1e-10);
        }
    });

    it('should have consistent peak amplitude', () => {
        const peaks = [];

        for (let hit = 0; hit < 10; hit++) {
            // Trigger
            kick.inputs.trigger[0] = 10;
            kick.inputs.trigger.fill(0, 1);

            let peak = 0;

            // Process and find peak
            for (let buf = 0; buf < 10; buf++) {
                kick.process();
                for (let i = 0; i < bufferSize; i++) {
                    peak = Math.max(peak, Math.abs(kick.outputs.out[i]));
                }
                kick.inputs.trigger.fill(0);
            }

            peaks.push(peak);

            // Decay
            for (let i = 0; i < 20; i++) {
                kick.process();
            }
        }

        // All peaks should be identical
        const refPeak = peaks[0];
        for (let i = 1; i < peaks.length; i++) {
            expect(peaks[i]).toBeCloseTo(refPeak, 10);
        }

        console.log('Peak values:', peaks);
    });
});
