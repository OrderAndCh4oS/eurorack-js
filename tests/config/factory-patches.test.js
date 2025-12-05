import { describe, it, expect } from 'vitest';
import { FACTORY_PATCHES } from '../../src/js/config/factory-patches.js';

describe('factory-patches', () => {
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
                expect(patch.state.knobs).toBeDefined();
                expect(typeof patch.state.knobs).toBe('object');
                expect(patch.state.cables).toBeDefined();
                expect(Array.isArray(patch.state.cables)).toBe(true);
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
    });

    describe('knob values', () => {
        it('should have knob values within valid ranges', () => {
            Object.values(FACTORY_PATCHES).forEach(patch => {
                Object.entries(patch.state.knobs).forEach(([module, params]) => {
                    Object.values(params).forEach(value => {
                        expect(typeof value).toBe('number');
                        expect(isFinite(value)).toBe(true);
                    });
                });
            });
        });

        it('should have volume knobs <= 1', () => {
            Object.values(FACTORY_PATCHES).forEach(patch => {
                if (patch.state.knobs.out?.volume !== undefined) {
                    expect(patch.state.knobs.out.volume).toBeLessThanOrEqual(1);
                }
            });
        });
    });
});
