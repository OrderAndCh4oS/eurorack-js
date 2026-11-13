import sharp from 'sharp';
import { ulid } from 'ulid';
import { createImageStore } from '../server/image-store.js';

if (process.env.VERCEL !== '1' || process.env.VERCEL_ENV !== 'preview') {
    throw new Error('Storage integration check requires a Vercel preview build.');
}
const store = await createImageStore();
const key = `rack-previews/${ulid()}/thumbnail.png`;
const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#f0eee2' } }).png().toBuffer();
try {
    await store.put(key, png);
    const downloaded = await store.get(key);
    if (!downloaded.equals(png)) throw new Error('Private rack image round-trip did not match.');
    console.log('Private image upload and authenticated download verified.');
} finally {
    await store.delete(key);
    console.log('Preview storage check object removed.');
}
