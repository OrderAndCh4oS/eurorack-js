import { describe, it, expect, beforeEach } from 'vitest';
import {
    createCableManager,
    createCablePath,
    getJackCenter
} from '../../src/js/cables/cable-manager.js';

describe('cable-manager', () => {
    describe('createCableManager', () => {
        let manager;

        beforeEach(() => {
            manager = createCableManager();
        });

        it('should create a manager with no cables', () => {
            expect(manager.count).toBe(0);
            expect(manager.getCables()).toEqual([]);
        });

        describe('addCable', () => {
            it('should add a cable', () => {
                const cable = manager.addCable({
                    fromModule: 'lfo',
                    fromPort: 'primary',
                    toModule: 'vco',
                    toPort: 'vOct'
                });

                expect(cable.id).toBeDefined();
                expect(cable.fromModule).toBe('lfo');
                expect(cable.toModule).toBe('vco');
                expect(cable.color).toBeDefined();
                expect(manager.count).toBe(1);
            });

            it('should assign different colors to cables', () => {
                const cable1 = manager.addCable({
                    fromModule: 'lfo', fromPort: 'primary',
                    toModule: 'vco', toPort: 'vOct'
                });
                const cable2 = manager.addCable({
                    fromModule: 'lfo', fromPort: 'secondary',
                    toModule: 'vco', toPort: 'pwm'
                });

                expect(cable1.color).not.toBe(cable2.color);
            });

            it('should replace existing cable to same input', () => {
                manager.addCable({
                    fromModule: 'lfo', fromPort: 'primary',
                    toModule: 'vco', toPort: 'vOct'
                });
                manager.addCable({
                    fromModule: 'noise', fromPort: 'sh',
                    toModule: 'vco', toPort: 'vOct'
                });

                expect(manager.count).toBe(1);
                const cables = manager.getCables();
                expect(cables[0].fromModule).toBe('noise');
            });
        });

        describe('removeCable', () => {
            it('should remove a cable by ID', () => {
                const cable = manager.addCable({
                    fromModule: 'lfo', fromPort: 'primary',
                    toModule: 'vco', toPort: 'vOct'
                });

                const removed = manager.removeCable(cable.id);
                expect(removed).toBe(cable);
                expect(manager.count).toBe(0);
            });

            it('should return null for non-existent cable', () => {
                const removed = manager.removeCable('non-existent');
                expect(removed).toBeNull();
            });
        });

        describe('removeCableTo', () => {
            it('should remove cable to specific input', () => {
                manager.addCable({
                    fromModule: 'lfo', fromPort: 'primary',
                    toModule: 'vco', toPort: 'vOct'
                });

                const removed = manager.removeCableTo('vco', 'vOct');
                expect(removed).not.toBeNull();
                expect(manager.count).toBe(0);
            });
        });

        describe('removeCablesForModule', () => {
            it('should remove all cables for a module', () => {
                manager.addCable({
                    fromModule: 'lfo', fromPort: 'primary',
                    toModule: 'vco', toPort: 'vOct'
                });
                manager.addCable({
                    fromModule: 'vco', fromPort: 'triangle',
                    toModule: 'vca', toPort: 'ch1In'
                });

                const removed = manager.removeCablesForModule('vco');
                expect(removed.length).toBe(2);
                expect(manager.count).toBe(0);
            });
        });

        describe('getCablesFrom', () => {
            it('should get cables from specific output', () => {
                manager.addCable({
                    fromModule: 'lfo', fromPort: 'primary',
                    toModule: 'vco', toPort: 'vOct'
                });
                manager.addCable({
                    fromModule: 'lfo', fromPort: 'primary',
                    toModule: 'vcf', toPort: 'cutoffCV'
                });

                const cables = manager.getCablesFrom('lfo', 'primary');
                expect(cables.length).toBe(2);
            });
        });

        describe('getCableTo', () => {
            it('should get cable to specific input', () => {
                manager.addCable({
                    fromModule: 'lfo', fromPort: 'primary',
                    toModule: 'vco', toPort: 'vOct'
                });

                const cable = manager.getCableTo('vco', 'vOct');
                expect(cable).not.toBeNull();
                expect(cable.fromModule).toBe('lfo');
            });

            it('should return null if not connected', () => {
                const cable = manager.getCableTo('vco', 'vOct');
                expect(cable).toBeNull();
            });
        });

        describe('isInputConnected', () => {
            it('should return true if connected', () => {
                manager.addCable({
                    fromModule: 'lfo', fromPort: 'primary',
                    toModule: 'vco', toPort: 'vOct'
                });

                expect(manager.isInputConnected('vco', 'vOct')).toBe(true);
            });

            it('should return false if not connected', () => {
                expect(manager.isInputConnected('vco', 'vOct')).toBe(false);
            });
        });

        describe('clear', () => {
            it('should remove all cables', () => {
                manager.addCable({
                    fromModule: 'lfo', fromPort: 'primary',
                    toModule: 'vco', toPort: 'vOct'
                });
                manager.addCable({
                    fromModule: 'vco', fromPort: 'triangle',
                    toModule: 'vca', toPort: 'ch1In'
                });

                manager.clear();
                expect(manager.count).toBe(0);
            });
        });

        describe('serialize/loadCables', () => {
            it('should serialize cables', () => {
                manager.addCable({
                    fromModule: 'lfo', fromPort: 'primary',
                    toModule: 'vco', toPort: 'vOct'
                });

                const serialized = manager.serialize();
                expect(serialized.length).toBe(1);
                expect(serialized[0]).toEqual({
                    fromModule: 'lfo',
                    fromPort: 'primary',
                    toModule: 'vco',
                    toPort: 'vOct'
                });
            });

            it('should load cables from serialized data', () => {
                const data = [
                    { fromModule: 'lfo', fromPort: 'primary', toModule: 'vco', toPort: 'vOct' },
                    { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' }
                ];

                manager.loadCables(data);
                expect(manager.count).toBe(2);
            });
        });
    });

    describe('createCablePath', () => {
        it('should create an SVG path string', () => {
            const path = createCablePath(0, 0, 100, 100);
            expect(path).toContain('M');
            expect(path).toContain('C');
        });

        it('should start at x1, y1', () => {
            const path = createCablePath(10, 20, 100, 100);
            expect(path).toContain('M 10 20');
        });

        it('should end at x2, y2', () => {
            const path = createCablePath(0, 0, 150, 200);
            expect(path).toContain('150 200');
        });
    });

    describe('getJackCenter', () => {
        it('should return center coordinates', () => {
            const jack = document.createElement('div');
            // Mock getBoundingClientRect
            jack.getBoundingClientRect = () => ({
                left: 100,
                top: 200,
                width: 20,
                height: 20
            });

            const center = getJackCenter(jack);
            expect(center.x).toBe(110);
            expect(center.y).toBe(210);
        });
    });
});
