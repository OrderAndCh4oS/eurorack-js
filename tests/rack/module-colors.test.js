import { beforeAll, describe, expect, it } from 'vitest';
import { loadCorePlugin, pluginRegistry } from '../../src/js/index.js';
import { isModuleColorToken, MODULE_COLOR_TOKENS } from '../../src/js/utils/color.js';

describe('module color tokens', () => {
    beforeAll(async () => {
        await loadCorePlugin();
    });

    it('keeps built-in modules on the shared 12-color token palette', () => {
        const colors = pluginRegistry.getAllDefinitions().map(def => def.color);

        expect(colors.every(isModuleColorToken)).toBe(true);
    });

    it('uses every shared module color token', () => {
        const usedColors = new Set(pluginRegistry.getAllDefinitions().map(def => def.color));

        MODULE_COLOR_TOKENS.forEach(token => {
            expect(usedColors.has(token)).toBe(true);
        });
    });
});
