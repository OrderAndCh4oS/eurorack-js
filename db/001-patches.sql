CREATE TABLE IF NOT EXISTS patch_records (
    id text PRIMARY KEY CHECK (id ~ '^[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
    data jsonb NOT NULL,
    CHECK (data->>'id' = id),
    CHECK (data->>'visibility' IN ('private', 'public'))
);
CREATE UNIQUE INDEX IF NOT EXISTS patch_create_request ON patch_records ((data->>'ownerId'), (data->>'requestId'));
CREATE INDEX IF NOT EXISTS patch_owner_page ON patch_records ((data->>'ownerId'), id DESC);
CREATE INDEX IF NOT EXISTS patch_public_page ON patch_records (id DESC) WHERE data->>'visibility' = 'public';
-- Deliberately no patch foreign key: delayed retries must not resurrect a deleted patch.
CREATE TABLE IF NOT EXISTS patch_requests (
    owner_id text NOT NULL,
    request_id text NOT NULL CHECK (request_id ~ '^[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
    patch_id text NOT NULL,
    request_hash text NOT NULL,
    PRIMARY KEY (owner_id, request_id)
);
INSERT INTO patch_requests(owner_id, request_id, patch_id, request_hash)
SELECT data->>'ownerId', data->>'requestId', id, data->>'requestHash' FROM patch_records ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS patch_previews (
    id text PRIMARY KEY CHECK (id ~ '^[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
    data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS patch_preview_owner ON patch_previews ((data->>'ownerId'));
-- Object deletion is retried after the association transaction commits. A failed
-- S3 delete must never roll back records into references to already deleted bytes.
CREATE TABLE IF NOT EXISTS patch_image_garbage (
    key text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS patch_likes (
    patch_id text NOT NULL REFERENCES patch_records(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (patch_id, user_id)
);
CREATE INDEX IF NOT EXISTS patch_likes_period ON patch_likes (patch_id, created_at);
CREATE TABLE IF NOT EXISTS patch_rate_limits (
    key text NOT NULL,
    bucket bigint NOT NULL,
    count integer NOT NULL,
    PRIMARY KEY (key, bucket)
);
