export function readS3ImageConfig(env = process.env) {
    const endpoint = env.S3_ENDPOINT || env.AWS_ENDPOINT_URL_S3;
    let endpointValid = false;
    try {
        const parsed = new URL(endpoint);
        endpointValid = ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
            && (env.NODE_ENV !== 'production' || parsed.protocol === 'https:');
    } catch { /* Missing/invalid configuration leaves image publishing disabled. */ }
    const bucket = env.S3_BUCKET;
    const accessKeyId = env.S3_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;
    return {
        enabled: !!(endpointValid && bucket && accessKeyId && secretAccessKey), provider: 's3', endpoint, bucket,
        region: env.S3_REGION || env.AWS_REGION || env.AWS_DEFAULT_REGION || 'auto', accessKeyId, secretAccessKey,
        sessionToken: env.S3_SESSION_TOKEN || env.AWS_SESSION_TOKEN,
        // Neon's generated AWS_* configuration uses branch endpoints with path-style buckets.
        forcePathStyle: env.S3_FORCE_PATH_STYLE === undefined ? !!(!env.S3_ENDPOINT && env.AWS_ENDPOINT_URL_S3) : env.S3_FORCE_PATH_STYLE === 'true'
    };
}
export function readImageConfig(env = process.env) {
    if (env.BLOB_READ_WRITE_TOKEN) return { provider: 'vercel-blob', enabled: typeof env.BLOB_READ_WRITE_TOKEN === 'string' && !!env.BLOB_READ_WRITE_TOKEN.trim(), token: env.BLOB_READ_WRITE_TOKEN };
    return readS3ImageConfig(env);
}
export function readConfig(env = process.env) {
    const required = ['BETTER_AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
    const missing = required.filter(key => !env[key]);
    const databaseUrl = env.DATABASE_URL || env.STORAGE_URL;
    let databaseConfigured = false;
    try {
        const database = new URL(databaseUrl);
        if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || !database.pathname.slice(1)) throw new Error();
        databaseConfigured = true;
    } catch { missing.push('DATABASE_URL or STORAGE_URL (PostgreSQL URL)'); }
    if (!env.BETTER_AUTH_URL && !env.APP_URL) missing.push('BETTER_AUTH_URL');
    if (env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length < 32) missing.push('BETTER_AUTH_SECRET (at least 32 characters)');
    let baseUrl;
    try {
        const parsed = new URL(env.BETTER_AUTH_URL || env.APP_URL);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error();
        if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') throw new Error();
        baseUrl = parsed.origin;
    } catch { if (!missing.includes('BETTER_AUTH_URL')) missing.push('BETTER_AUTH_URL (valid application origin)'); }
    const imagesEnabled = readImageConfig(env).enabled;
    return { enabled: missing.length === 0, imagesEnabled, baseUrl, databaseUrl, databaseConfigured, missing };
}
