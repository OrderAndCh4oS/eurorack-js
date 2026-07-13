import { beforeAll, describe, it, expect } from 'vitest';
import { FACTORY_PATCHES } from '../../src/js/config/factory-patches.js';
import { normalizePatch } from '../../src/js/app/patch-format.js';
import { MODULE_MANIFEST } from '../../src/js/rack/module-manifest.js';

describe('factory-patches', () => {
    let moduleDefinitions;

    beforeAll(async () => {
        moduleDefinitions = new Map(await Promise.all(MODULE_MANIFEST.map(async entry => {
            const module = await entry.load();
            return [entry.id, module.default];
        })));
    });

    describe('FACTORY_PATCHES', () => {
        it('should be an object', () => {
            expect(typeof FACTORY_PATCHES).toBe('object');
        });

        it('should have multiple patches', () => {
            expect(Object.keys(FACTORY_PATCHES).length).toBeGreaterThan(5);
        });

        it('should have test patches', () => {
            const testPatches = Object.keys(FACTORY_PATCHES).filter(k => k.startsWith('Test'));
            expect(testPatches.length).toBeGreaterThan(0);
        });

        it('should have demo patches', () => {
            const demoPatches = Object.keys(FACTORY_PATCHES).filter(k => k.startsWith('Demo'));
            expect(demoPatches.length).toBeGreaterThan(0);
        });
    });

    describe('patch structure', () => {
        it('should have required properties for each patch', () => {
            Object.entries(FACTORY_PATCHES).forEach(([name, patch]) => {
                expect(patch.name).toBe(name);
                expect(patch.factory).toBe(true);
                expect(patch.state).toBeDefined();
                expect(typeof patch.state).toBe('object');
            });
        });

        it('should have valid state structure', () => {
            Object.values(FACTORY_PATCHES).forEach(patch => {
                expect(patch.state.version).toBe(3);
                expect(patch.state.plugins).toEqual({ core: 1 });
                expect(Array.isArray(patch.state.modules)).toBe(true);
                expect(patch.state.params).toBeDefined();
                expect(typeof patch.state.params).toBe('object');
                expect(patch.state.cables).toBeDefined();
                expect(Array.isArray(patch.state.cables)).toBe(true);
                expect(patch.state.midiMappings).toBeDefined();
                expect(patch.state.knobs).toBeUndefined();
                expect(patch.state.switches).toBeUndefined();
                expect(patch.state.buttons).toBeUndefined();
                patch.state.modules.forEach(module => {
                    expect(module.id).toBeDefined();
                    expect(module.instanceId).toBeUndefined();
                });
            });
        });

        it('should have valid cable structure', () => {
            Object.values(FACTORY_PATCHES).forEach(patch => {
                patch.state.cables.forEach(cable => {
                    expect(cable.fromModule).toBeDefined();
                    expect(cable.fromPort).toBeDefined();
                    expect(cable.toModule).toBeDefined();
                    expect(cable.toPort).toBeDefined();
                });
            });
        });

        it('should only use cables that match normalized module ports', () => {
            Object.entries(FACTORY_PATCHES).forEach(([name, patch]) => {
                const state = normalizePatch(patch.state);
                const moduleTypes = new Map(state.modules.map(mod => [mod.id, mod.type]));

                state.cables.forEach(cable => {
                    const fromType = moduleTypes.get(cable.fromModule);
                    const toType = moduleTypes.get(cable.toModule);
                    const fromDefinition = moduleDefinitions.get(fromType);
                    const toDefinition = moduleDefinitions.get(toType);
                    const outputPorts = new Set((fromDefinition?.ui?.outputs || []).map(output => output.port));
                    const inputPorts = new Set((toDefinition?.ui?.inputs || []).map(input => input.port));

                    expect(fromType, `${name} cable references missing source module ${cable.fromModule}`).toBeDefined();
                    expect(toType, `${name} cable references missing destination module ${cable.toModule}`).toBeDefined();
                    expect(outputPorts, `${name} ${cable.fromModule} has no output port ${cable.fromPort}`).toContain(cable.fromPort);
                    expect(inputPorts, `${name} ${cable.toModule} has no input port ${cable.toPort}`).toContain(cable.toPort);
                });
            });
        });
    });

    describe('specific patches', () => {
        it('Test - VCO Only should route VCO to output', () => {
            const patch = FACTORY_PATCHES['Test - VCO Only'];
            expect(patch).toBeDefined();

            const vcoToVcaCables = patch.state.cables.filter(
                c => c.fromModule === 'vco' && c.toModule === 'vca'
            );
            expect(vcoToVcaCables.length).toBeGreaterThan(0);

            const vcaToOutCables = patch.state.cables.filter(
                c => c.fromModule === 'vca' && c.toModule === 'out'
            );
            expect(vcaToOutCables.length).toBeGreaterThan(0);
        });

        it('Demo - Melodic Arp should use arpeggiator', () => {
            const patch = FACTORY_PATCHES['Demo - Melodic Arp'];
            expect(patch).toBeDefined();

            const arpCables = patch.state.cables.filter(
                c => c.fromModule === 'arp' || c.toModule === 'arp'
            );
            expect(arpCables.length).toBeGreaterThan(0);
        });

        it('ships the complete numbered synth voice demo series', () => {
            const demos = Object.values(FACTORY_PATCHES)
                .filter(patch => patch.name.startsWith('Demo - Synth Voice'));

            expect(demos.map(patch => patch.name)).toEqual([
                'Demo - Synth Voice 01 - Subtractive',
                'Demo - Synth Voice 02 - Waveform Blend',
                'Demo - Synth Voice 03 - Tracked FM',
                'Demo - Synth Voice 04 - Sync Sweep',
                'Demo - Synth Voice 05 - Oscillator Stack',
                'Demo - Synth Voice 06 - Post-filter Noise',
                'Demo - Synth Voice 07 - Mixed CV',
                'Demo - Synth Voice 08 - Filter Modes',
                'Demo - Synth Voice 09 - Envelopes and Accents',
                'Demo - Synth Voice 10 - Animated Envelope',
                'Demo - Synth Voice 11 - VCA Modulation',
                'Demo - Synth Voice 12 - Dynamic Generative'
            ]);
            demos.forEach(patch => {
                expect(patch.state.cables).toEqual(expect.arrayContaining([
                    expect.objectContaining({ toModule: 'out', toPort: 'L' }),
                    expect.objectContaining({ toModule: 'out', toPort: 'R' })
                ]));
            });
        });

        it('routes control voltage through a VCA in the modulation-depth demo', () => {
            const patch = FACTORY_PATCHES['Demo - Synth Voice 11 - VCA Modulation'];
            expect(patch.state.cables).toEqual(expect.arrayContaining([
                expect.objectContaining({ fromModule: 'fastLfo', toModule: 'modVca', toPort: 'ch1In' }),
                expect.objectContaining({ fromModule: 'slowLfo', toModule: 'modVca', toPort: 'ch1CV' }),
                expect.objectContaining({ fromModule: 'modVca', toModule: 'vcf', toPort: 'cutoffCV' })
            ]));
        });

        it('builds the round-robin demo from held pitch and complementary voice gates', () => {
            const patch = FACTORY_PATCHES['Demo - Round Robin - Alternating Voices'];
            expect(patch).toBeDefined();
            expect(patch.state.params.seq.length).toBe(7);
            expect(patch.state.params.pitchRoute.steps).toBe(2);
            expect(patch.state.params.gateA).toMatchObject({ length: 2, hits: 1, rotate: 1 });
            expect(patch.state.params.gateB).toMatchObject({ length: 2, hits: 1, rotate: 0 });
            expect(patch.state.cables).toEqual(expect.arrayContaining([
                expect.objectContaining({ fromModule: 'seq', fromPort: 'cv', toModule: 'pitchRoute', toPort: 'commonIn' }),
                expect.objectContaining({ fromModule: 'pitchRoute', fromPort: 'out1', toModule: 'pitchHold', toPort: 'in1' }),
                expect.objectContaining({ fromModule: 'pitchRoute', fromPort: 'out2', toModule: 'pitchHold', toPort: 'in2' }),
                expect.objectContaining({ fromModule: 'gateA', toModule: 'pitchHold', toPort: 'trig1' }),
                expect.objectContaining({ fromModule: 'gateB', toModule: 'pitchHold', toPort: 'trig2' }),
                expect.objectContaining({ fromModule: 'gateA', toModule: 'envA', toPort: 'gate' }),
                expect.objectContaining({ fromModule: 'gateB', toModule: 'envB', toPort: 'gate' }),
                expect.objectContaining({ fromModule: 'voices', toModule: 'out', toPort: 'L' }),
                expect.objectContaining({ fromModule: 'voices', toModule: 'out', toPort: 'R' })
            ]));
        });

        it('Test - Quantizer Scales should use simple quantizer', () => {
            const patch = FACTORY_PATCHES['Test - Quantizer Scales'];
            expect(patch).toBeDefined();

            const quantCables = patch.state.cables.filter(
                c => c.fromModule === 'quant' || c.toModule === 'quant'
            );
            expect(quantCables.length).toBeGreaterThan(0);
        });

        it('Test - Arpeggiator should use arp module', () => {
            const patch = FACTORY_PATCHES['Test - Arpeggiator'];
            expect(patch).toBeDefined();

            const arpCables = patch.state.cables.filter(
                c => c.fromModule === 'arp' || c.toModule === 'arp'
            );
            expect(arpCables.length).toBeGreaterThan(0);
        });

        it('Demo - Neon Grid uses exactly three rows with drums, bass, and melody texture', () => {
            const patch = FACTORY_PATCHES['Demo - Neon Grid'];
            expect(patch).toBeDefined();

            const rows = [...new Set(patch.state.modules.map(mod => mod.row))].sort();
            const types = patch.state.modules.map(mod => mod.type);

            expect(rows).toEqual([1, 2, 3]);
            expect(types).toEqual(expect.arrayContaining([
                'kick', 'snare', 'hat',
                'seq', 'vco', 'vcf', 'vca',
                'turing', 'quant', 'granulita',
                'chorus', 'verb', 'dly', 'out'
            ]));
            expect(patch.state.cables).toEqual(expect.arrayContaining([
                expect.objectContaining({ toModule: 'kick', toPort: 'trigger' }),
                expect.objectContaining({ toModule: 'bassVco', toPort: 'vOct' }),
                expect.objectContaining({ toModule: 'leadVco', toPort: 'vOct' }),
                expect.objectContaining({ toModule: 'granulita', toPort: 'hit' }),
                expect.objectContaining({ toModule: 'out', toPort: 'L' })
            ]));
        });

        it('Test - Custom Modules includes every custom-rendered module', () => {
            const patch = FACTORY_PATCHES['Test - Custom Modules'];
            expect(patch).toBeDefined();

            const types = patch.state.modules.map(mod => mod.type);
            const customRenderedTypes = [...moduleDefinitions.values()]
                .filter(definition => typeof definition.render === 'function')
                .map(definition => definition.id);
            expect(types).toEqual(expect.arrayContaining(customRenderedTypes));
            const connectedModuleIds = new Set(patch.state.cables.flatMap(cable => [
                cable.fromModule,
                cable.toModule
            ]));
            const customRenderedIds = patch.state.modules
                .filter(module => customRenderedTypes.includes(module.type))
                .map(module => module.id);
            expect(customRenderedIds.every(id => connectedModuleIds.has(id))).toBe(true);
            expect(patch.state.cables).toEqual(expect.arrayContaining([
                expect.objectContaining({ toModule: 'scope', toPort: 'in1' }),
                expect.objectContaining({ toModule: 'plot', toPort: 'audio' }),
                expect.objectContaining({ toModule: 'spectrogram', toPort: 'audio' }),
                expect.objectContaining({ toModule: 'spectrum', toPort: 'audio' }),
                expect.objectContaining({ toModule: 'db', toPort: 'L' }),
                expect.objectContaining({ toModule: 'rec', toPort: 'L' }),
                expect.objectContaining({ fromModule: 'joy', toModule: 'vcf', toPort: 'resCV' }),
                expect.objectContaining({ fromModule: 'joy', toModule: 'lpg', toPort: 'dampCV' }),
                expect.objectContaining({ fromModule: 'lpg', toModule: 'vca', toPort: 'ch1In' })
            ]));
        });
    });

    describe('knob values', () => {
        it('should have knob values within valid ranges', () => {
            const expectFiniteValue = value => {
                if (typeof value === 'number') {
                    expect(isFinite(value)).toBe(true);
                    return;
                }
                expect(value && typeof value === 'object').toBeTruthy();
                Object.values(value).forEach(expectFiniteValue);
            };
            Object.values(FACTORY_PATCHES).forEach(patch => {
                Object.entries(patch.state.params).forEach(([, params]) => {
                    Object.values(params).forEach(expectFiniteValue);
                });
            });
        });

        it('should have volume knobs <= 1', () => {
            Object.values(FACTORY_PATCHES).forEach(patch => {
                const params = patch.state.params;
                if (params.out?.volume !== undefined) {
                    expect(params.out.volume).toBeLessThanOrEqual(1);
                }
            });
        });
    });
});
