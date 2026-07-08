import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CATEGORY_ORDER } from '../../src/js/rack/module-manifest.js';

const VALID_STATUSES = ['candidate', 'researching', 'spec-ready', 'implementing', 'blocked', 'done'];
const VALID_RISKS = ['Low', 'Medium', 'High'];

async function fileExists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function loadQueueRows() {
    const markdown = await readFile('research/module-queue.md', 'utf8');

    return markdown
        .split('\n')
        .filter(line => line.startsWith('| `'))
        .map(line => {
            const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
            return {
                id: cells[0].replaceAll('`', ''),
                status: cells[1],
                researchDoc: cells[2],
                category: cells[4],
                risk: cells[7]
            };
        });
}

describe('module queue', () => {
    it('uses unique lowercase module ids', async () => {
        const rows = await loadQueueRows();
        const ids = rows.map(row => row.id);

        expect(rows.length).toBeGreaterThan(0);
        expect(new Set(ids).size).toBe(ids.length);
        ids.forEach(id => {
            expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        });
    });

    it('uses valid queue statuses, categories, and risk levels', async () => {
        const rows = await loadQueueRows();

        rows.forEach(row => {
            expect(VALID_STATUSES, `${row.id} has invalid status`).toContain(row.status);
            expect(CATEGORY_ORDER, `${row.id} has invalid category`).toContain(row.category);
            expect(VALID_RISKS, `${row.id} has invalid risk`).toContain(row.risk);
        });
    });

    it('requires active queue items to point at research docs', async () => {
        const rows = await loadQueueRows();

        for (const row of rows) {
            if (row.status === 'candidate') {
                expect(row.researchDoc, `${row.id} candidates should not claim completed research`).toBe('needed');
                continue;
            }

            expect(row.researchDoc, `${row.id} must link a research doc`).toMatch(/^research\/modules\/.+\.md$/);
            expect(await fileExists(row.researchDoc), `${row.id} research doc is missing`).toBe(true);
        }
    });
});
