// JSONB holds the versioned application envelope; SQL indexes enforce identities and requests.
// All mutations use one short advisory transaction lock. This deliberately favors correctness
// at hobby-project traffic; it can be replaced with ordered owner/record locks if traffic grows.
export class PostgresStore {
    constructor(pool, client = null) { this.pool = pool; this.client = client; }
    query(sql, values = []) { return (this.client || this.pool).query(sql, values); }
    async transaction(work) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(716335822)');
            const result = await work(new PostgresStore(this.pool, client));
            await client.query('COMMIT'); return result;
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
    async getPatch(id) { return (await this.query('SELECT data FROM patch_records WHERE id=$1', [id])).rows[0]?.data; }
    async putPatch(record) {
        await this.query('INSERT INTO patch_records(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data', [record.id, record]);
        await this.query('INSERT INTO patch_requests(owner_id,request_id,patch_id,request_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [record.ownerId, record.requestId, record.id, record.requestHash]);
    }
    async deletePatch(id) { await this.query('DELETE FROM patch_records WHERE id=$1', [id]); }
    async findRequest(ownerId, requestId) {
        const result = (await this.query('SELECT p.data,r.patch_id,r.request_hash FROM patch_requests r LEFT JOIN patch_records p ON p.id=r.patch_id WHERE r.owner_id=$1 AND r.request_id=$2', [ownerId, requestId])).rows[0];
        return result ? result.data || { id: result.patch_id, requestHash: result.request_hash, deleted: true } : undefined;
    }
    async listPatches({ ownerId, publicOnly, query = '', sort, asOf, since, direction, boundary, limit }) {
        // Only these server-selected SQL fragments vary; all request values remain parameters.
        const operator = direction === 'previous' ? '>' : '<';
        const order = direction === 'previous' ? 'ASC' : 'DESC';
        const score = sort === 'popular' ? `(SELECT count(*)::int FROM patch_likes l WHERE l.patch_id=p.id
            AND l.created_at <= $4::timestamptz AND ($5::timestamptz IS NULL OR l.created_at >= $5::timestamptz))` : '0';
        return (await this.query(`WITH ranked AS (
            SELECT p.id, p.data, ${score} AS score FROM patch_records p
            WHERE ($1::text IS NULL OR p.data->>'ownerId'=$1) AND (NOT $2::boolean OR p.data->>'visibility'='public')
            AND strpos(lower(concat(p.data->>'name',' ',p.data->>'description',' ',p.data->>'authorName')),lower($3))>0
            AND (p.data->>'createdAt')::timestamptz <= $4::timestamptz
            AND ($5::timestamptz IS NULL OR $5::timestamptz <= $4::timestamptz)
        ) SELECT data, score FROM ranked
            WHERE ($6::text IS NULL OR (score, id) ${operator} ($7::int, $6::text))
            ORDER BY score ${order}, id ${order} LIMIT $8`,
        [ownerId || null, !!publicOnly, query, asOf, since, boundary?.id || null, boundary?.score ?? null, limit])).rows.map(row => ({ ...row.data, popularityCount: row.score }));
    }
    async totals(ownerId) {
        const result = await this.query(`SELECT count(*)::int AS count, COALESCE(sum((data->>'stateBytes')::int),0)::bigint AS "stateBytes",
            (SELECT COALESCE(sum((data->>'bytes')::int),0)::bigint FROM patch_previews WHERE data->>'ownerId'=$1) AS "imageBytes"
            FROM patch_records WHERE data->>'ownerId'=$1`, [ownerId]);
        return Object.fromEntries(Object.entries(result.rows[0]).map(([k, v]) => [k, Number(v)]));
    }
    async getPreview(id) { return (await this.query('SELECT data FROM patch_previews WHERE id=$1', [id])).rows[0]?.data; }
    async putPreview(record) { await this.query('INSERT INTO patch_previews(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data', [record.id, record]); }
    async deletePreview(id) { await this.query('DELETE FROM patch_previews WHERE id=$1', [id]); }
    async previewReferences(id) { return (await this.query("SELECT count(*)::int AS count FROM patch_records WHERE data->>'previewId'=$1", [id])).rows[0].count; }
    async listPreviews() { return (await this.query('SELECT data FROM patch_previews')).rows.map(r => r.data); }
    async objectReferences(key) { return (await this.query("SELECT count(*)::int AS count FROM patch_previews WHERE EXISTS (SELECT 1 FROM jsonb_each(data->'variants') v WHERE v.value->>'key'=$1)", [key])).rows[0].count; }
    async addGarbage(key) { await this.query('INSERT INTO patch_image_garbage(key) VALUES($1) ON CONFLICT DO NOTHING', [key]); }
    async listGarbage() { return (await this.query('SELECT key FROM patch_image_garbage ORDER BY created_at LIMIT 1000')).rows.map(row => row.key); }
    async garbageCount() { return (await this.query('SELECT count(*)::int AS count FROM patch_image_garbage')).rows[0].count; }
    async deleteGarbage(key) { await this.query('DELETE FROM patch_image_garbage WHERE key=$1', [key]); }
    async setLike(patchId, userId, liked, createdAt = new Date().toISOString()) {
        if (liked) await this.query('INSERT INTO patch_likes(patch_id,user_id,created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [patchId, userId, createdAt]);
        else await this.query('DELETE FROM patch_likes WHERE patch_id=$1 AND user_id=$2', [patchId, userId]);
    }
    async likes(patchId, userId) {
        return (await this.query('SELECT count(*)::int AS "likeCount", COALESCE(bool_or(user_id=$2),false) AS "likedByMe" FROM patch_likes WHERE patch_id=$1', [patchId, userId || ''])).rows[0];
    }
    async consumeRate(key, bucket, maximum) {
        const result = await this.query('INSERT INTO patch_rate_limits(key,bucket,count) VALUES($1,$2,1) ON CONFLICT(key,bucket) DO UPDATE SET count=patch_rate_limits.count+1 RETURNING count', [key, bucket]);
        return result.rows[0].count <= maximum;
    }
}
