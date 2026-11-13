import { Pool } from 'pg';
import { readConfig } from '../server/config.js';
import { PostgresStore } from '../server/postgres-store.js';
import { createImageStore } from '../server/image-store.js';
import { createPatchService } from '../server/patch-service.js';

const config = readConfig();
if (!config.databaseConfigured || !config.imagesEnabled) throw new Error('Configure the database and image storage before cleanup.');
const pool = new Pool({ connectionString: config.databaseUrl, max: 2 });
try {
    const service = createPatchService({ store: new PostgresStore(pool), imageStore: await createImageStore(process.env) });
    const result = await service.cleanupPreviews();
    await pool.query('DELETE FROM patch_rate_limits WHERE bucket < $1', [Math.floor(Date.now() / 60000) - 1440]);
    console.log(`Removed ${result.removed} unreferenced rack preview associations; ${result.pendingObjects} object deletions will retry.`);
} finally { await pool.end(); }
