import { compactVerify, createRemoteJWKSet } from 'jose';
import { z } from 'zod';
import { assert, HttpError } from './validation.js';

const subjects = {
    'sign-in': 'Sign in to Eurorack JS',
    'email-verification': 'Verify your Eurorack JS email address',
    'forget-password': 'Reset your Eurorack JS password'
};

export function createNeonEmailHandler({ neonUrl, apiKey, from }, appOrigin,
    keys = createRemoteJWKSet(new URL(`${neonUrl}/.well-known/jwks.json`))) {
    const branch = new URL(neonUrl);
    return async (headers, body) => {
        const signature = headers.get('x-neon-signature') || '';
        const timestamp = headers.get('x-neon-timestamp');
        const [header, empty, mac] = signature.split('.');
        const unauthorized = () => new HttpError(401, 'invalid_signature', 'Invalid email event signature.');
        if (empty !== '' || !header || !mac || signature.split('.').length !== 3
            || !/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300000) throw unauthorized();
        // Neon's detached JWS signs base64url(timestamp + "." + base64url(raw body)).
        const payload = Buffer.from(`${timestamp}.${body.toString('base64url')}`).toString('base64url');
        const { protectedHeader } = await compactVerify(`${header}.${payload}.${mac}`, keys, { algorithms: ['EdDSA'] })
            .catch(() => { throw unauthorized(); });
        if (!protectedHeader.kid || protectedHeader.kid !== headers.get('x-neon-signature-kid')) throw unauthorized();
        const event = JSON.parse(body.toString('utf8'));
        const data = event.event_data, email = event.user?.email;
        // The signature covers the envelope. Use its event ID for retries and
        // its branch for isolation even when a proxy rewrites transport headers.
        const checks = {
            event: event.event_type === 'send.magic_link',
            id: typeof event.event_id === 'string' && /^[\w-]{1,128}$/.test(event.event_id),
            branch: event.context?.endpoint_id === branch.hostname.split('.')[0],
            recipient: z.email().safeParse(email).success,
            type: Object.hasOwn(subjects, data?.link_type)
        };
        const rejected = Object.keys(checks).filter(key => !checks[key]);
        if (rejected.length) {
            console.warn('Neon email event rejected', { fields: rejected });
            throw new HttpError(400, 'invalid_email_event', 'Invalid Neon email event.');
        }
        const subject = subjects[data.link_type];
        let link;
        if (data.link_type === 'sign-in') {
            assert(typeof data.token === 'string' && data.token.length > 0 && data.token.length <= 512, 'Invalid sign-in token.');
            link = new URL('/email-sign-in.html', appOrigin);
            // Fragments stay out of HTTP logs. The page redeems only on an explicit click.
            link.hash = new URLSearchParams({ token: data.token }).toString();
        } else {
            // Neon also fires this event for its verification and password-reset emails.
            link = new URL(data.link_url);
            assert(link.origin === branch.origin && !link.username && !link.password && link.pathname.startsWith(branch.pathname.replace(/\/$/, '') + '/'), 'Invalid Neon email link.');
        }
        const href = link.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
        const note = 'If you didn’t request this email, you can ignore it.';
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(6000),
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `neon-auth/${event.event_id}` },
            body: JSON.stringify({ from, to: [email], subject, text: `${subject}\n\n${link.href}\n\n${note}`,
                html: `<p><a href="${href}">${subject}</a></p><p>${note}</p>` })
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.warn('Resend rejected an authentication email', { status: response.status,
                code: /^[a-z_]{1,64}$/.test(error.name) ? error.name : 'unknown' });
            throw new HttpError(502, 'email_delivery_failed', 'Email delivery is temporarily unavailable.');
        }
    };
}
