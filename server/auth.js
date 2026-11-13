import { betterAuth } from 'better-auth';
import { ulid } from 'ulid';

export function authOptions(pool, env) {
    return {
        database: pool,
        baseURL: env.BETTER_AUTH_URL || env.APP_URL,
        basePath: '/api/auth',
        secret: env.BETTER_AUTH_SECRET,
        trustedOrigins: [new URL(env.BETTER_AUTH_URL || env.APP_URL).origin],
        socialProviders: { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } },
        emailAndPassword: { enabled: false },
        session: { cookieCache: { enabled: false } },
        rateLimit: { enabled: true, storage: 'database', window: 60, max: 60 },
        advanced: { database: { generateId: () => ulid() }, disableOriginCheck: false, disableCSRFCheck: false,
            useSecureCookies: (env.BETTER_AUTH_URL || env.APP_URL).startsWith('https:') }
    };
}
export function createAuth(pool, env) { return betterAuth(authOptions(pool, env)); }
