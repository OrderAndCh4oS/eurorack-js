import { betterAuth } from 'better-auth';
import { ulid } from 'ulid';
import { readEmailAuthConfig } from './config.js';
import { neonMagicLink } from './neon-magic-link.js';

export function authOptions(pool, env) {
    const origin = new URL(env.BETTER_AUTH_URL || env.APP_URL).origin;
    const email = readEmailAuthConfig(env);
    return {
        database: pool,
        baseURL: env.BETTER_AUTH_URL || env.APP_URL,
        basePath: '/api/auth',
        secret: env.BETTER_AUTH_SECRET,
        trustedOrigins: [origin],
        socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
            ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } } : {},
        plugins: email ? [neonMagicLink(email.neonUrl, origin)] : [],
        emailAndPassword: { enabled: false },
        session: { cookieCache: { enabled: false } },
        rateLimit: { enabled: true, storage: 'database', window: 60, max: 60 },
        advanced: { database: { generateId: () => ulid() }, disableOriginCheck: false, disableCSRFCheck: false,
            useSecureCookies: (env.BETTER_AUTH_URL || env.APP_URL).startsWith('https:') }
    };
}
export function createAuth(pool, env) { return betterAuth(authOptions(pool, env)); }
