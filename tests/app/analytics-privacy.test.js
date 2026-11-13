// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const html = readFileSync('src/index.html', 'utf8');
const bootstrap = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const patchId = '01K00000000000000000000000';

function loadHook() {
    const window = {};
    runInNewContext(bootstrap, { window, URL });
    const registration = window.vaq.find(args => args[0] === 'beforeSend');
    return { window, beforeSend: registration?.[1] };
}

describe('Vercel analytics URL privacy', () => {
    it('registers the documented hook before loading analytics and keeps the client enabled', () => {
        const { window, beforeSend } = loadHook();
        expect(typeof window.va).toBe('function');
        expect(typeof beforeSend).toBe('function');
        expect(html.indexOf("window.va('beforeSend'")).toBeLessThan(html.indexOf('src="/_vercel/insights/script.js"'));
        expect(html.match(/src="\/_vercel\/insights\/script\.js"/g)).toHaveLength(1);
    });

    it.each([
        [`https://rack.example/?token=secret#saved=${patchId}`, 'https://rack.example/'],
        ['https://rack.example/#patch=gz1.private-patch-state', 'https://rack.example/'],
        [`https://rack.example/patches/${patchId}?source=private#details`, 'https://rack.example/patches/[id]'],
        [`https://rack.example/patches/${patchId}/images/${patchId}/full.png`, 'https://rack.example/patches/[id]'],
        ['https://rack.example/patches?q=private-name', 'https://rack.example/patches'],
        ['https://rack.example/', 'https://rack.example/']
    ])('retains an aggregate page view while removing sensitive URL data from %s', (url, expected) => {
        const { beforeSend } = loadHook();
        const event = { type: 'pageview', url };
        const sanitized = beforeSend(event);
        expect(sanitized).toEqual({ type: 'pageview', url: expected });
        expect(event.url).toBe(url);
        expect(JSON.stringify(sanitized)).not.toContain(patchId);
        expect(JSON.stringify(sanitized)).not.toContain('private');
        expect(JSON.stringify(sanitized)).not.toContain('secret');
    });

    it('drops malformed event URLs instead of forwarding them unredacted', () => {
        const { beforeSend } = loadHook();
        expect(beforeSend({ type: 'pageview', url: 'not a URL' })).toBeNull();
    });
});
