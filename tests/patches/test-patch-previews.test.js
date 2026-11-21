// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { TEST_PATCHES } from '../../src/js/config/test-patches.js';
import { TEST_PATCH_PREVIEWS } from '../../src/js/config/test-patch-previews.js';
import { getTestPatchPreview } from '../../src/js/patches/patch-preview.js';

describe('pre-rendered test rack thumbnails', () => {
    it.each(['light', 'dark'])('ships a current, bounded %s WebP for every test patch', async mode => {
        expect(Object.keys(TEST_PATCH_PREVIEWS)).toEqual(Object.keys(TEST_PATCHES));
        let total = 0;
        for (const [name, patch] of Object.entries(TEST_PATCHES)) {
            const preview = await getTestPatchPreview(patch.state, name, mode);
            expect(TEST_PATCH_PREVIEWS[name].dark.file).not.toBe(TEST_PATCH_PREVIEWS[name].light.file);
            expect(preview, `Regenerate the stale thumbnail for ${name}`).not.toBeNull();
            expect(preview.file).toMatch(/^[a-f0-9]{64}\.webp$/);
            const bytes = await readFile(new URL(`../../src/patch-previews/${preview.file}`, import.meta.url));
            expect(createHash('sha256').update(bytes).digest('hex')).toBe(preview.file.slice(0, -5));
            const metadata = await sharp(bytes).metadata();
            expect(metadata.format).toBe('webp');
            expect(metadata.width).toBe(preview.width);
            expect(metadata.height).toBe(preview.height);
            expect(metadata.width).toBeLessThanOrEqual(640);
            expect(metadata.height).toBeLessThanOrEqual(480);
            expect(bytes.length).toBe(preview.bytes);
            expect(bytes.length).toBeLessThan(100000);
            const [red] = await sharp(bytes).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
            if (mode === 'dark') expect(red).toBeLessThan(50);
            else expect(red).toBeGreaterThan(200);
            total += bytes.length;
        }
        expect(total).toBeLessThan(4 * 1024 * 1024);
    });

    it('falls back to runtime capture when a test patch changes', async () => {
        const name = Object.keys(TEST_PATCHES)[0];
        const state = structuredClone(TEST_PATCHES[name].state);
        state.modules[0].row += 1;
        expect(await getTestPatchPreview(state, name)).toBeNull();
        expect(await getTestPatchPreview(state, 'Unknown patch')).toBeNull();
    });
});
