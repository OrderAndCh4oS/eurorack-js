import { APIError, createAuthEndpoint, formCsrfMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { handleOAuthUserInfo } from 'better-auth/oauth2';
import { z } from 'zod';

// Neon owns the one-time proof. Better Auth binds the verified provider identity
// to the same local account and session used by Google and existing patch owners.
export function neonMagicLink(neonUrl, origin) {
    const start = '/sign-in/magic-link', finish = '/magic-link/confirm';
    const unavailable = () => new APIError('SERVICE_UNAVAILABLE', { message: 'Email sign-in is unavailable. Try again later.' });
    const invalidLink = () => new APIError('BAD_REQUEST', { message: 'This link has expired or has already been used. Request a new sign-in link.' });
    async function request(url, options) {
        try {
            return await fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(18000) });
        } catch { throw unavailable(); }
    }
    return {
        id: 'neon-magic-link',
        endpoints: {
            requestEmailLink: createAuthEndpoint(start, {
                method: 'POST', use: [formCsrfMiddleware], body: z.object({ email: z.email().max(254) })
            }, async ctx => {
                const response = await request(`${neonUrl}/sign-in/magic-link`, {
                    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: ctx.body.email, callbackURL: origin })
                });
                if (response.status === 429) throw new APIError('TOO_MANY_REQUESTS', { message: 'Please wait a minute before requesting another link.' });
                if (!response.ok) throw unavailable();
                return ctx.json({ status: true });
            }),
            confirmEmailLink: createAuthEndpoint(finish, {
                method: 'POST', use: [formCsrfMiddleware], body: z.object({ token: z.string().min(1).max(512) })
            }, async ctx => {
                const url = new URL(`${neonUrl}/magic-link/verify`);
                url.searchParams.set('token', ctx.body.token);
                // Omitting callbackURL requests the verified user in JSON. Never
                // forward a browser cookie, follow a redirect, or expose Neon's token.
                const response = await request(url, { headers: { Origin: origin, Accept: 'application/json' } });
                if (response.status >= 500 || response.status === 429) throw unavailable();
                if (!response.ok) throw invalidLink();
                const result = await response.json().catch(() => null);
                const user = result?.user;
                if (!user?.id || user.emailVerified !== true || !z.email().safeParse(user.email).success
                    || result.session?.userId !== user.id) throw invalidLink();
                const identity = await handleOAuthUserInfo(ctx, {
                    account: { providerId: 'neon-magic-link', accountId: user.id },
                    userInfo: { id: user.id, email: user.email, emailVerified: true, name: user.name || 'Patch maker' },
                    requireExactAccountBinding: true
                });
                if (!identity.data) throw unavailable();
                await setSessionCookie(ctx, identity.data);
                return ctx.json({ status: true });
            })
        },
        rateLimit: [{ pathMatcher: path => path === start || path === finish, window: 60, max: 5 }]
    };
}
