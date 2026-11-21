import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { LIMITS, assert, HttpError } from './validation.js';
import { readImageConfig, readS3ImageConfig } from './config.js';

export async function hasRackDetail(thumbnail) {
    // A nonempty rack has contrasting panel controls and rails. A nearly
    // uniform WebP can still decode successfully and have the right dimensions.
    const { channels } = await sharp(thumbnail, { limitInputPixels: LIMITS.imagePixels }).stats();
    return channels.slice(0, 3).some(channel => channel.max - channel.min > 12);
}

export async function rasterVariants(input, mode = 'light') {
    assert(input.byteLength && input.byteLength <= LIMITS.uploadBytes, 'Rack image exceeds 2 MiB.', 413, 'image_too_large');
    try {
        const metadata = await sharp(input, { limitInputPixels: LIMITS.imagePixels, animated: false }).metadata();
        assert(['png', 'jpeg', 'webp'].includes(metadata.format) && (metadata.pages || 1) === 1, 'Upload a single PNG, JPEG or WebP rack image.');
        assert(metadata.width > 0 && metadata.height > 0 && metadata.width * metadata.height <= LIMITS.imagePixels, 'Rack image dimensions are too large.');
        // Decode then re-encode: never serve uploaded SVG, metadata, or untrusted original bytes.
        const background = mode === 'dark' ? '#171813' : '#f0eee2';
        const clean = sharp(input, { limitInputPixels: LIMITS.imagePixels }).rotate().flatten({ background });
        const buffers = await Promise.all([
            clean.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).png({ palette: true, colours: 128, compressionLevel: 9 }).toBuffer(),
            clean.clone().resize({ width: 640, height: 420, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer(),
            clean.clone().resize({ width: 1200, height: 630, fit: 'contain', background }).png({ palette: true, colours: 128, compressionLevel: 9 }).toBuffer()
        ]);
        assert(buffers.reduce((n, b) => n + b.length, 0) <= LIMITS.imageBytes, 'Rack image is too complex; use a smaller capture.', 413, 'image_too_large');
        return Object.fromEntries(await Promise.all(['full', 'thumbnail', 'social'].map(async (name, i) => {
            const size = await sharp(buffers[i]).metadata();
            return [mode === 'dark' ? `dark-${name}` : name, { body: buffers[i], width: size.width, height: size.height, format: size.format, contentType: `image/${size.format}` }];
        })));
    } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(400, 'invalid_image', 'The rack image could not be decoded.');
    }
}
export function createS3ImageStore(env) {
    const config = readS3ImageConfig(env);
    assert(config.enabled, 'Private object storage is not configured.', 503, 'images_unavailable');
    const client = new S3Client({ endpoint: config.endpoint, region: config.region,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, ...(config.sessionToken ? { sessionToken: config.sessionToken } : {}) },
        forcePathStyle: config.forcePathStyle });
    return {
        async put(key, body, { contentType = 'image/png' } = {}) { await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'private, no-store' })); },
        async get(key) { const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key })); return Buffer.from(await result.Body.transformToByteArray()); },
        async delete(key) { await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key })); }
    };
}

export async function createImageStore(env = process.env) {
    const config = readImageConfig(env);
    assert(config.enabled, 'Private image storage is not configured.', 503, 'images_unavailable');
    if (config.provider === 'vercel-blob') {
        const { createVercelBlobImageStore } = await import('./vercel-blob-image-store.js');
        return createVercelBlobImageStore(env);
    }
    return createS3ImageStore(env);
}
