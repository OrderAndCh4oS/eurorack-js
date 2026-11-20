// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { magicLink } from 'better-auth/plugins';
import { createLocalJWKSet } from 'jose';
import { authOptions } from '../../server/auth.js';
import { readConfig } from '../../server/config.js';
import { createHandler } from '../../server/handler.js';
import { createNeonEmailHandler } from '../../server/neon-auth-email.js';
import { MemoryStore } from '../../server/memory-store.js';

const origin = 'https://rack.example';
const neonUrl = 'https://ep-fixture.neonauth.example/neondb/auth';
const env = { APP_URL: origin, BETTER_AUTH_SECRET: 'local-only-auth-fixture-32-characters',
    GOOGLE_CLIENT_ID: 'google-test', GOOGLE_CLIENT_SECRET: 'google-secret',
    DATABASE_URL: 'postgres://localhost/fixture', NEON_AUTH_BASE_URL: neonUrl, RESEND_API_KEY: 'resend-test-secret' };
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const kid = 'neon-fixture';
const keys = createLocalJWKSet({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid, alg: 'EdDSA' }] });
const tables = () => ({ user: [], session: [], account: [], verification: [], rateLimit: [] });
let app, local, upstream, messages, lastEvent, deliveryStatus;

function webhookRequest(event, time = Date.now()) {
    const body = JSON.stringify(event), header = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid })).toString('base64url');
    const payload = Buffer.from(`${time}.${Buffer.from(body).toString('base64url')}`).toString('base64url');
    const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
    return new Request(`${origin}/api/webhooks/neon-auth`, { method: 'POST', body, headers: {
        'x-neon-timestamp': String(time), 'x-neon-signature': `${header}..${signature}`, 'x-neon-signature-kid': kid,
        'x-neon-event-id': event.event_id, 'x-neon-event-type': event.event_type
    } });
}
const post = (path, body, from = origin) => app(new Request(origin + '/api/auth/' + path, { method: 'POST',
    headers: { origin: from, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const start = email => post('sign-in/magic-link', { email });
const confirm = token => post('magic-link/confirm', { token });
const emailToken = () => new URLSearchParams(new URL(messages.at(-1).body.text.split('\n')[2]).hash.slice(1)).get('token');
beforeEach(() => {
    local = tables(); upstream = tables(); messages = []; deliveryStatus = 200;
    const config = readConfig(env);
    const auth = betterAuth({ ...authOptions(memoryAdapter(local), env), logger: { disabled: true } });
    app = createHandler({ store: new MemoryStore(), baseUrl: origin, authMethods: config.authMethods,
        authenticate: async req => (await auth.api.getSession({ headers: req.headers }))?.user,
        authHandler: auth.handler, emailHandler: createNeonEmailHandler(config.emailAuth, origin, keys) });
    const neon = betterAuth({ baseURL: neonUrl, basePath: '/neondb/auth', secret: env.BETTER_AUTH_SECRET,
        trustedOrigins: [origin], database: memoryAdapter(upstream), logger: { disabled: true }, plugins: [magicLink({
            storeToken: 'hashed', async sendMagicLink({ email, token, url }) {
                lastEvent = { event_id: randomUUID(), event_type: 'send.magic_link', context: { endpoint_id: 'internal-endpoint' },
                    user: { email }, event_data: { link_type: 'sign-in', token, link_url: url } };
                const delivered = await app(webhookRequest(lastEvent));
                if (!delivered.ok) throw new Error('Webhook failed');
            }
        })] });
    vi.stubGlobal('fetch', async (url, options) => {
        if (String(url).startsWith(neonUrl + '/')) return neon.handler(new Request(url, options));
        expect(String(url)).toBe('https://api.resend.com/emails');
        expect(options.headers.Authorization).toBe('Bearer ' + env.RESEND_API_KEY);
        messages.push({ body: JSON.parse(options.body), key: options.headers['Idempotency-Key'] });
        return Response.json({}, { status: deliveryStatus });
    });
});
afterEach(() => vi.unstubAllGlobals());

it('uses the existing verified Google account, session and patch owner after one email-link redemption', async () => {
    const now = new Date(), id = 'legacy-google-owner', email = 'musician@example.org';
    local.user.push({ id, name: 'Artist', emailVerified: true, email, createdAt: now, updatedAt: now });
    local.account.push({ id: 'google-account', providerId: 'google', accountId: 'google-subject', userId: id, createdAt: now, updatedAt: now });
    const sent = await start(email);
    expect(sent.status).toBe(200);
    expect(await sent.json()).toEqual({ status: true });
    expect(messages[0].body).toMatchObject({ to: [email], subject: 'Sign in to Eurorack JS' });
    expect(messages[0].body.text).toContain(origin + '/email-sign-in.html#token=');
    const token = emailToken();
    const redeemed = await confirm(token);
    expect(redeemed.status).toBe(200);
    expect(await redeemed.json()).toEqual({ status: true });
    const cookie = redeemed.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const me = await app(new Request(origin + '/api/me', { headers: { cookie } }));
    expect((await me.json()).user).toEqual({ id, name: 'Artist' });
    expect(local.user).toHaveLength(1);
    expect(local.account.map(a => a.providerId)).toEqual(['google', 'neon-magic-link']);
    expect((await confirm(token)).status).toBe(400);
    expect(local.session).toHaveLength(1);
});
it('creates an email-only account, rejects expired links and reports delivery failures without returning tokens', async () => {
    expect((await start('new@example.org')).status).toBe(200);
    expect((await confirm(emailToken())).status).toBe(200);
    expect(local.user[0]).toMatchObject({ email: 'new@example.org', emailVerified: true, name: 'Patch maker' });
    await start('late@example.org');
    upstream.verification[0].expiresAt = new Date(0);
    expect((await confirm(emailToken())).status).toBe(400);
    deliveryStatus = 403;
    const failed = await start('another@example.org');
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain(env.RESEND_API_KEY);
});
it('requires a fresh, signed event for this branch and gives delivery retries the same Resend key', async () => {
    expect((await post('sign-in/magic-link', { email: 'someone@example.org' }, 'https://elsewhere.example')).status).toBe(403);
    await start('inbox@example.org');
    const signed = webhookRequest(lastEvent);
    const tampered = new Request(signed.url, { method: 'POST', headers: signed.headers, body: JSON.stringify({ ...lastEvent, user: { email: 'different@example.org' } }) });
    expect((await app(tampered)).status).toBe(401);
    expect((await app(webhookRequest(lastEvent, Date.now() - 360000))).status).toBe(401);
    const sibling = { ...lastEvent.event_data, link_url: lastEvent.event_data.link_url.replace('ep-fixture', 'ep-other') };
    expect((await app(webhookRequest({ ...lastEvent, event_data: sibling }))).status).toBe(400);
    expect(messages).toHaveLength(1);
    expect((await app(signed)).status).toBe(200);
    expect(messages[1].key).toBe(messages[0].key);
});
it('advertises configured providers independently and keeps secrets out of public config', async () => {
    expect(readConfig({ ...env, GOOGLE_CLIENT_ID: '' })).toMatchObject({ enabled: true, authMethods: { google: false, magicLink: true } });
    expect(readConfig({ ...env, RESEND_API_KEY: '' })).toMatchObject({ enabled: true, authMethods: { google: true, magicLink: false } });
    const config = await (await app(new Request(origin + '/api/config'))).json();
    expect(config.authMethods).toEqual({ google: true, magicLink: true });
    expect(JSON.stringify(config)).not.toContain(env.RESEND_API_KEY);
});
