import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODULE_MANIFEST } from '../../src/js/rack/module-manifest.js';
import {
    AUDIT_BLOCK_SIZES,
    AUDIT_SAMPLE_RATES,
    auditDefinition,
    auditScenario,
    createAuditMidiService,
    createSeededRandom,
    measureSignal
} from '../../scripts/lib/dsp-audit.js';

describe('DSP audit measurements', () => {
    it('uses reproducible seeded noise', () => {
        const first = createSeededRandom(42);
        const second = createSeededRandom(42);
        expect(Array.from({ length: 16 }, first)).toEqual(Array.from({ length: 16 }, second));
    });

    it('measures a known sine wave', () => {
        const sampleRate = 48000;
        const samples = Float32Array.from({ length: sampleRate }, (_, index) => (
            Math.sin(2 * Math.PI * 1000 * index / sampleRate) * 2
        ));
        const result = measureSignal(samples, sampleRate);

        expect(result.finite).toBe(true);
        expect(result.peak).toBeCloseTo(2, 3);
        expect(result.rms).toBeCloseTo(Math.SQRT2, 3);
        expect(result.dc).toBeCloseTo(0, 5);
        expect(result.estimatedFrequency).toBeCloseTo(1000, 0);
    });

    it('detects non-finite samples', () => {
        const result = measureSignal([0, 1, Number.NaN, Number.POSITIVE_INFINITY], 48000);
        expect(result.finite).toBe(false);
    });

    it('provides deterministic MIDI activity for event-driven modules', () => {
        const midi = createAuditMidiService();
        midi.beginBlock();
        expect(midi.getNoteEvents(0).map(event => event.note)).toEqual([60, 64, 67]);
        expect(midi.getNoteEvents(0).map(event => event.note)).toEqual([60, 64, 67]);
        expect(midi.getClockEvents()).toHaveLength(25);
        midi.endBlock();
        expect(midi.getCCValue(0, 1)).toBe(96);
    });

    it('reports output voltage-contract violations with their signal contract', () => {
        const definition = {
            id: 'audit-fixture',
            name: 'Audit Fixture',
            category: 'other',
            createDSP({ bufferSize }) {
                const out = new Float32Array(bufferSize);
                return {
                    params: {}, inputs: {}, outputs: { out },
                    process() { out.fill(6); }
                };
            },
            ui: { inputs: [], outputs: [{ id: 'out', port: 'out', signal: 'audio' }] }
        };
        const [scenario] = auditDefinition(definition, { blocks: 1 }).scenarios;

        expect(scenario.outputs.out.voltageCompliant).toBe(false);
        expect(scenario.outputs.out.signal).toBe('audio');
        expect(scenario.outputs.out.voltage).toEqual({ min: -5, max: 5 });
    });

    it('runs every registered definition with stable finite buffers', async () => {
        const definitions = await Promise.all(MODULE_MANIFEST.map(async entry => (await entry.load()).default));
        for (const definition of definitions) {
            for (const sampleRate of AUDIT_SAMPLE_RATES) {
                for (const blockSize of AUDIT_BLOCK_SIZES) {
                    const result = auditScenario(definition, {
                        sampleRate,
                        blockSize,
                        blocks: 2
                    });
                    expect(result.error, definition.id).toBeNull();
                    expect(result.stableInputs, definition.id).toBe(true);
                    expect(result.stableOutputs, definition.id).toBe(true);
                    if (result.reset) expect(result.reset.finite, definition.id).toBe(true);
                    Object.values(result.outputs).forEach(output => {
                        expect(output.finite, definition.id).toBe(true);
                    });
                }
            }
        }
    });

    it('keeps one dated audit record per registered module', () => {
        const registered = MODULE_MANIFEST.map(entry => entry.id).sort();
        const documented = fs.readdirSync('research/modules')
            .filter(file => file.endsWith('.md'))
            .map(file => file.slice(0, -3))
            .sort();

        expect(documented).toEqual(registered);
        documented.forEach(id => {
            const content = fs.readFileSync(`research/modules/${id}.md`, 'utf8');
            expect(content, id).toContain('## DSP Audit (2026-07-11)');
        });
    });

    it('keeps every control scenario inside its declared voltage contract', async () => {
        const definitions = await Promise.all(MODULE_MANIFEST.map(async entry => (await entry.load()).default));
        for (const definition of definitions) {
            for (const sampleRate of AUDIT_SAMPLE_RATES) {
                for (const blockSize of AUDIT_BLOCK_SIZES) {
                    const result = auditDefinition(definition, {
                        sampleRate, blockSize, blocks: 4
                    });
                    result.scenarios.forEach(scenario => {
                        Object.entries(scenario.outputs).forEach(([port, output]) => {
                            expect(
                                output.voltageCompliant,
                                `${definition.id}.${port} in ${scenario.name} at ${sampleRate}/${blockSize}`
                            ).toBe(true);
                        });
                    });
                }
            }
        }
    });
});
