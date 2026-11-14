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
-- Public identity is independent of the Google account's name and email. Changing
-- it updates attribution on read without changing rack revisions or fork lineage.
CREATE TABLE IF NOT EXISTS patch_profiles (
    user_id text PRIMARY KEY,
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80 AND position('@' IN name)=0),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patch_request_patch ON patch_requests(patch_id);
-- Requests outlive deleted patches, so older fork credits can retain the parent's
-- stable creator identity even if that source patch was removed already.
UPDATE patch_records p SET data=jsonb_set(p.data, '{parentCreatorId}', to_jsonb(r.owner_id))
FROM patch_requests r WHERE p.data->>'parentId'=r.patch_id AND p.data->>'parentCreatorId' IS NULL;
