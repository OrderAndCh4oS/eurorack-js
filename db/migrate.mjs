import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from '../server/auth.js';
import { readConfig } from '../server/config.js';

const config = readConfig();
if (!config.databaseConfigured) throw new Error('Set DATABASE_URL or STORAGE_URL to a PostgreSQL database first.');
const pool = new Pool({ connectionString: config.databaseUrl, max: 2 });
try {
    // Uses the installed, pinned Better Auth version's actual schema, including its rate limits.
    // Schema generation does not contact Google or start a login server. Database setup can
    // happen before OAuth provisioning; this local-only origin is used solely for the schema.
    const migrationEnv = { ...process.env, BETTER_AUTH_URL: config.baseUrl || 'http://localhost:3000' };
    const migrations = await getMigrations(authOptions(pool, migrationEnv));
    await migrations.runMigrations();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(716335822)');
        await client.query(await readFile(new URL('./001-patches.sql', import.meta.url), 'utf8'));
        await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    console.log('Better Auth and patch database migrations applied.');
} finally { await pool.end(); }
