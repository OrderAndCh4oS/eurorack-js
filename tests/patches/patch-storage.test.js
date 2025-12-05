import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPatchStorage } from '../../src/js/patches/patch-storage.js';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn(key => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = value; }),
        removeItem: vi.fn(key => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; })
    };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock factory patches
vi.mock('../../src/js/config/factory-patches.js', () => ({
    FACTORY_PATCHES: {
        'Factory One': {
            name: 'Factory One',
            factory: true,
            state: { knobs: {}, cables: [] }
        },
        'Factory Two': {
            name: 'Factory Two',
            factory: true,
            state: { knobs: {}, cables: [] }
        }
    }
}));

describe('patch-storage', () => {
    let storage;

    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
        storage = createPatchStorage('test-patches');
    });

    describe('getAllPatches', () => {
        it('should return factory patches when no user patches', () => {
            const patches = storage.getAllPatches();
            expect(patches['Factory One']).toBeDefined();
            expect(patches['Factory Two']).toBeDefined();
        });

        it('should merge factory and user patches', () => {
            localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
                'User Patch': { name: 'User Patch', factory: false, state: {} }
            }));

            const patches = storage.getAllPatches();
            expect(patches['Factory One']).toBeDefined();
            expect(patches['User Patch']).toBeDefined();
        });

        it('should allow user patches to override factory', () => {
            localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
                'Factory One': { name: 'Factory One', factory: false, state: { custom: true } }
            }));

            const patches = storage.getAllPatches();
            expect(patches['Factory One'].state.custom).toBe(true);
        });
    });

    describe('getFactoryPatches', () => {
        it('should return only factory patches', () => {
            const patches = storage.getFactoryPatches();
            expect(Object.keys(patches).length).toBe(2);
            expect(patches['Factory One']).toBeDefined();
        });
    });

    describe('getUserPatches', () => {
        it('should return only user patches', () => {
            localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
                'User Patch': { name: 'User Patch', factory: false, state: {} }
            }));

            const patches = storage.getUserPatches();
            expect(patches['User Patch']).toBeDefined();
            expect(patches['Factory One']).toBeUndefined();
        });

        it('should return empty object if no user patches', () => {
            const patches = storage.getUserPatches();
            expect(patches).toEqual({});
        });

        it('should handle corrupted localStorage', () => {
            localStorageMock.getItem.mockReturnValueOnce('invalid json');

            const patches = storage.getUserPatches();
            expect(patches).toEqual({});
        });
    });

    describe('getPatch', () => {
        it('should get factory patch by name', () => {
            const patch = storage.getPatch('Factory One');
            expect(patch).toBeDefined();
            expect(patch.name).toBe('Factory One');
        });

        it('should get user patch by name', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify({
                'User Patch': { name: 'User Patch', factory: false, state: {} }
            }));

            const patch = storage.getPatch('User Patch');
            expect(patch).toBeDefined();
            expect(patch.name).toBe('User Patch');
        });

        it('should return null for non-existent patch', () => {
            const patch = storage.getPatch('Does Not Exist');
            expect(patch).toBeNull();
        });
    });

    describe('hasPatch', () => {
        it('should return true for existing factory patch', () => {
            expect(storage.hasPatch('Factory One')).toBe(true);
        });

        it('should return true for existing user patch', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify({
                'User Patch': { name: 'User Patch', factory: false, state: {} }
            }));

            expect(storage.hasPatch('User Patch')).toBe(true);
        });

        it('should return false for non-existent patch', () => {
            expect(storage.hasPatch('Does Not Exist')).toBe(false);
        });
    });

    describe('isFactoryPatch', () => {
        it('should return true for factory patches', () => {
            expect(storage.isFactoryPatch('Factory One')).toBe(true);
        });

        it('should return false for user patches', () => {
            expect(storage.isFactoryPatch('User Patch')).toBe(false);
        });
    });

    describe('savePatch', () => {
        it('should save a new user patch', () => {
            const state = { knobs: { vco: { freq: 440 } }, cables: [] };

            const result = storage.savePatch('New Patch', state);

            expect(result).toBe(true);
            expect(localStorageMock.setItem).toHaveBeenCalled();

            const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
            expect(savedData['New Patch']).toBeDefined();
            expect(savedData['New Patch'].state).toEqual(state);
        });

        it('should trim patch name', () => {
            storage.savePatch('  Spaced Name  ', { knobs: {}, cables: [] });

            const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
            expect(savedData['Spaced Name']).toBeDefined();
        });

        it('should reject empty patch name', () => {
            const result = storage.savePatch('', { knobs: {}, cables: [] });
            expect(result).toBe(false);
        });

        it('should reject whitespace-only patch name', () => {
            const result = storage.savePatch('   ', { knobs: {}, cables: [] });
            expect(result).toBe(false);
        });

        it('should include created timestamp', () => {
            storage.savePatch('Timestamped', { knobs: {}, cables: [] });

            const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
            expect(savedData['Timestamped'].created).toBeDefined();
        });
    });

    describe('deletePatch', () => {
        it('should delete user patch', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify({
                'User Patch': { name: 'User Patch', factory: false, state: {} }
            }));

            const result = storage.deletePatch('User Patch');

            expect(result).toBe(true);
            const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
            expect(savedData['User Patch']).toBeUndefined();
        });

        it('should not delete factory patch', () => {
            const result = storage.deletePatch('Factory One');
            expect(result).toBe(false);
        });

        it('should return false for non-existent patch', () => {
            const result = storage.deletePatch('Does Not Exist');
            expect(result).toBe(false);
        });
    });

    describe('renamePatch', () => {
        it('should rename user patch', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify({
                'Old Name': { name: 'Old Name', factory: false, state: {} }
            }));

            const result = storage.renamePatch('Old Name', 'New Name');

            expect(result).toBe(true);
            const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
            expect(savedData['Old Name']).toBeUndefined();
            expect(savedData['New Name']).toBeDefined();
            expect(savedData['New Name'].name).toBe('New Name');
        });

        it('should not rename factory patch', () => {
            const result = storage.renamePatch('Factory One', 'New Name');
            expect(result).toBe(false);
        });

        it('should reject empty new name', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify({
                'Old Name': { name: 'Old Name', factory: false, state: {} }
            }));

            const result = storage.renamePatch('Old Name', '');
            expect(result).toBe(false);
        });

        it('should trim new name', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify({
                'Old Name': { name: 'Old Name', factory: false, state: {} }
            }));

            storage.renamePatch('Old Name', '  Trimmed  ');

            const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
            expect(savedData['Trimmed']).toBeDefined();
        });

        it('should return false for non-existent patch', () => {
            const result = storage.renamePatch('Does Not Exist', 'New Name');
            expect(result).toBe(false);
        });
    });

    describe('getPatchNames', () => {
        it('should return all patch names', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify({
                'User Patch': { name: 'User Patch', factory: false, state: {} }
            }));

            const names = storage.getPatchNames();
            expect(names).toContain('Factory One');
            expect(names).toContain('Factory Two');
            expect(names).toContain('User Patch');
        });
    });

    describe('getFactoryPatchNames', () => {
        it('should return only factory patch names', () => {
            const names = storage.getFactoryPatchNames();
            expect(names).toContain('Factory One');
            expect(names).toContain('Factory Two');
            expect(names.length).toBe(2);
        });
    });

    describe('getUserPatchNames', () => {
        it('should return only user patch names', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify({
                'User Patch': { name: 'User Patch', factory: false, state: {} }
            }));

            const names = storage.getUserPatchNames();
            expect(names).toContain('User Patch');
            expect(names).not.toContain('Factory One');
        });
    });

    describe('clearUserPatches', () => {
        it('should clear all user patches', () => {
            storage.clearUserPatches();

            expect(localStorageMock.setItem).toHaveBeenCalledWith('test-patches', '{}');
        });
    });

    describe('exportPatches', () => {
        it('should export user patches as JSON', () => {
            const userPatches = {
                'User Patch': { name: 'User Patch', factory: false, state: {} }
            };
            localStorageMock.getItem.mockReturnValue(JSON.stringify(userPatches));

            const exported = storage.exportPatches();

            expect(JSON.parse(exported)).toEqual(userPatches);
        });

        it('should format JSON with indentation', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify({
                'User Patch': { name: 'User Patch', factory: false, state: {} }
            }));

            const exported = storage.exportPatches();

            expect(exported).toContain('\n');
        });
    });

    describe('importPatches', () => {
        it('should import patches from JSON', () => {
            const toImport = JSON.stringify({
                'Imported Patch': { name: 'Imported Patch', factory: false, state: {} }
            });

            const count = storage.importPatches(toImport);

            expect(count).toBe(1);
            const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
            expect(savedData['Imported Patch']).toBeDefined();
        });

        it('should merge with existing patches by default', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify({
                'Existing Patch': { name: 'Existing Patch', factory: false, state: {} }
            }));

            const toImport = JSON.stringify({
                'Imported Patch': { name: 'Imported Patch', factory: false, state: {} }
            });

            storage.importPatches(toImport, true);

            const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
            expect(savedData['Existing Patch']).toBeDefined();
            expect(savedData['Imported Patch']).toBeDefined();
        });

        it('should replace existing patches when merge=false', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify({
                'Existing Patch': { name: 'Existing Patch', factory: false, state: {} }
            }));

            const toImport = JSON.stringify({
                'Imported Patch': { name: 'Imported Patch', factory: false, state: {} }
            });

            storage.importPatches(toImport, false);

            const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
            expect(savedData['Existing Patch']).toBeUndefined();
            expect(savedData['Imported Patch']).toBeDefined();
        });

        it('should return 0 for invalid JSON', () => {
            const count = storage.importPatches('invalid json');
            expect(count).toBe(0);
        });

        it('should return 0 for non-object JSON', () => {
            const count = storage.importPatches('"string"');
            expect(count).toBe(0);
        });
    });
});
