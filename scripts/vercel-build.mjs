// Database setup is opt-in and runs inside the explicitly named Vercel
// environment, where sensitive credentials are available without downloading.
const migrateTarget = process.env.EURORACK_MIGRATE_DATABASE || (process.env.EURORACK_MIGRATE_PREVIEW === '1' ? 'preview' : null);
if (migrateTarget) {
    if (process.env.VERCEL !== '1' || !['preview', 'production'].includes(migrateTarget) || process.env.VERCEL_ENV !== migrateTarget) {
        throw new Error('Migration target must exactly match this Vercel deployment environment.');
    }
    await import('../db/migrate.mjs');
    if (migrateTarget === 'preview') await import('./check-preview-storage.mjs');
}
await import('./build.mjs');
