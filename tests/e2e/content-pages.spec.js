import { expect, test } from '@playwright/test';
import demo from '../../src/js/config/patches/demo-introduction.js';
import { readFile } from 'node:fs/promises';

const pageMetadata = page => page.locator('head').evaluate(head => [...head.querySelectorAll('link[rel="canonical"], meta[name="description"], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"]')].map(node => node.outerHTML).sort());

test('docs and introduction preserve the live rack, code, URLs and history', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.patchWorkbench);
    const rackMetadata = await pageMetadata(page);
    const socialCards = JSON.parse(await readFile('src/social-cards/manifest.json', 'utf8')).cards;
    await page.locator('#patchName').fill('Work in progress');
    await page.locator('#patchWorkbenchToggle').click();
    const editor = page.getByRole('textbox', { name: 'Patch script editor' });
    await editor.fill("patch().module('vco', 'unsavedIdea')");
    const rack = await page.evaluate(() => {
        window.originalRackApp = window.eurorackApp;
        return window.eurorackApp.host.serializePatch();
    });
    await page.locator('#patch-workbench').getByRole('link', { name: 'Guide', exact: true }).click();
    await expect(page).toHaveURL(/\/docs\/patch-workbench-guide$/);
    await expect(page.locator('#contentView h1')).toHaveText('Patch Workbench Guide');
    await page.screenshot({ path: testInfo.outputPath('docs-in-app.png') });
    await expect(page.locator('#toolbar')).toBeHidden();
    await expect(page.locator('#patch-workbench')).toBeHidden();
    await page.getByRole('navigation', { name: 'Documentation', exact: true }).getByRole('link', { name: 'WebMCP', exact: true }).click();
    await expect(page).toHaveTitle('WebMCP · Eurorack');
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://eurorackjs.orderandchaos.xyz/docs/webmcp');
    await expect(page.locator('head meta[property="og:image"]')).toHaveAttribute('content', `https://eurorackjs.orderandchaos.xyz/social-cards/${socialCards['/docs/webmcp'].file}`);
    await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Tool reference', exact: true }).click();
    await expect(page).toHaveURL(/\/docs\/webmcp#tool-reference$/);
    await expect(page.locator('#tool-reference')).toBeFocused();
    await page.locator('[data-content-view="introduction"]').click();
    await expect(page.locator('#contentView h1')).toHaveText('EurorackJS');
    await expect(page.locator('#contentView .marketing-tagline')).toHaveText('Modular synthesis');
    await expect(page).toHaveURL(/\/introduction$/);
    await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute('content', 'https://eurorackjs.orderandchaos.xyz/introduction');
    await expect(page.locator('head meta[name="twitter:image"]')).toHaveAttribute('content', `https://eurorackjs.orderandchaos.xyz/social-cards/${socialCards['/introduction'].file}`);
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'index, follow, max-image-preview:large');
    await page.goBack();
    await expect(page).toHaveTitle('WebMCP · Eurorack');
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://eurorackjs.orderandchaos.xyz/docs/webmcp');
    await expect(page.locator('#tool-reference')).toBeFocused();
    await page.locator('[data-patch-view="rack"]').click();
    await expect(page.locator('#patchName')).toHaveValue('Work in progress');
    await expect(editor).toHaveValue("patch().module('vco', 'unsavedIdea')");
    await expect(editor).toBeVisible();
    expect(await page.evaluate(() => window.eurorackApp === window.originalRackApp)).toBe(true);
    expect(await page.evaluate(() => window.eurorackApp.host.serializePatch())).toEqual(rack);
    await expect(page).toHaveTitle('Work in progress · Eurorack');
    expect(await pageMetadata(page)).toEqual(rackMetadata);
});

test('direct docs pages render without the instrument and copy exact code', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/docs/patch-workbench-guide');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Patch Workbench Guide');
    expect(await page.evaluate(() => !!window.eurorackApp)).toBe(false);
    const code = await page.locator('.docs-code pre code').first().textContent();
    await page.locator('[data-copy-code]').first().click();
    await expect(page.locator('[data-copy-code]').first()).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Patch Workbench Guide');
    expect((await page.request.get('/docs/missing-guide')).status()).toBe(404);
});

test('direct pages share rack navigation and support profile changes without loading the instrument', async ({ page }) => {
    let user = { id: 'reader', name: 'Patch maker' };
    let signInRequest;
    const requested = [];
    page.on('request', request => requested.push(new URL(request.url()).pathname));
    await page.route('**/api/config', route => route.fulfill({ json: { enabled: true, authMethods: { google: true, magicLink: true } } }));
    await page.route('**/api/me', async route => {
        if (route.request().method() === 'PATCH') user = { ...user, ...route.request().postDataJSON() };
        await route.fulfill({ json: { user } });
    });
    await page.route('**/api/auth/sign-out', route => {
        user = null;
        return route.fulfill({ json: { success: true } });
    });
    await page.route('**/api/auth/sign-in/social', route => {
        signInRequest = route.request().postDataJSON();
        return route.fulfill({ json: { redirect: false } });
    });

    for (const path of ['/docs/webmcp', '/introduction']) {
        await page.goto(path);
        const navigation = page.getByRole('navigation', { name: 'Patch views', exact: true });
        await expect(navigation.locator('a')).toHaveText(['Rack', 'New patch', 'My patches', 'Public patches', 'Test patches', 'Introduction', 'Docs']);
        await expect(navigation.getByRole('link', { name: 'New patch', exact: true })).toHaveAttribute('href', '/?new=1');
        await expect(navigation.locator('.patch-site-links [aria-current="page"]')).toHaveText(path.startsWith('/docs') ? 'Docs' : 'Introduction');
        await expect(navigation).toHaveCSS('height', '38px');
        await expect(page.locator('.site-wordmark, .site-navigation')).toHaveCount(0);
        await expect(navigation.getByRole('button', { name: 'Sign out', exact: true })).toBeEnabled();
    }

    await page.getByRole('button', { name: 'My profile', exact: true }).click();
    await page.getByRole('textbox', { name: 'Public name' }).fill('New public name');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#patchAccount')).toHaveAttribute('title', 'Signed in as New public name');
    await expect(page.locator('#patchNotice')).toContainText('Profile updated.');
    await page.locator('#patchAccount').click();
    await expect(page.locator('#patchAccount')).toHaveText('Sign in');
    await expect(page.locator('#patchProfile')).toBeHidden();
    await page.locator('#patchAccount').click();
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect.poll(() => signInRequest?.callbackURL).toBe(page.url());
    expect(signInRequest.provider).toBe('google');
    expect(requested.some(path => /\/js\/(app\/app|ui\/patch-library|modules\/|config\/patches)/.test(path))).toBe(false);
    expect(await page.evaluate(() => !!window.eurorackApp)).toBe(false);
});

test('mobile pages fit the viewport and expose collapsible documentation navigation', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/docs/webmcp');
    await expect(page.locator('.docs-menu')).not.toHaveAttribute('open');
    await page.screenshot({ path: testInfo.outputPath('docs-mobile.png'), fullPage: true });
    await page.locator('.docs-menu summary').click();
    await expect(page.getByRole('navigation', { name: 'Documentation', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/introduction');
    await expect(page.locator('.marketing-rack img')).toBeVisible();
    expect(await page.locator('.marketing-rack img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('introduction-mobile.png'), fullPage: true });
    await page.getByRole('link', { name: 'Read the docs' }).click();
    await expect(page).toHaveURL(/\/docs$/);
});

test('desktop pages show the product and readable documentation', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/introduction');
    await expect(page.locator('.marketing-rack img')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('introduction-desktop.png'), fullPage: true });
    await page.goto('/docs/patch-workbench-guide');
    await expect(page.locator('.docs-sidebar')).toBeVisible();
    await expect(page.locator('.docs-code').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('docs-desktop.png') });
});

test('agent code inspection returns from docs to the rack URL', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.patchWorkbench);
    await page.locator('[data-content-view="docs"]').click();
    await expect(page.locator('#contentView h1')).toBeVisible();
    await page.evaluate(() => window.eurorackApp.patchWorkbench.stageAgentScript("patch().module('out', 'main')"));
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('textbox', { name: 'Patch script editor' })).toBeVisible();
    await expect(page.locator('#contentView')).toBeHidden();
});

test('introduction demo opens in the rack and protects unsaved work on an in-app visit', async ({ page }) => {
    await page.goto('/introduction');
    await page.getByRole('link', { name: 'Open in rack', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#patchName')).toHaveValue(demo.name);
    expect(await page.evaluate(() => window.eurorackApp.patchLibrary.active.source)).toBe('demo');
    const outputId = demo.state.modules.find(module => module.type === 'out').id;
    expect(await page.evaluate(() => window.eurorackApp.host.serializePatch().modules)).toEqual(demo.state.modules);
    await expect(page.locator('#startButton')).not.toHaveClass(/active/);
    await page.locator('#startButton').click();
    await page.waitForFunction(id => {
        const output = window.eurorackApp.state.getModule(id)?.instance;
        return output?.leds?.L > 0 && output?.leds?.R > 0;
    }, outputId);
    await page.locator('#startButton').click();
    const edited = await page.evaluate(id => {
        window.originalRackApp = window.eurorackApp;
        window.eurorackApp.setParam(id, 'volume', 0.123);
        return window.eurorackApp.host.serializePatch();
    }, outputId);
    await page.locator('[data-content-view="introduction"]').click();
    await expect(page.locator('#contentView h1')).toHaveText('EurorackJS');
    await page.getByRole('link', { name: 'Open in rack', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page).toHaveURL(/\/introduction$/);
    expect(await page.evaluate(() => window.eurorackApp.host.serializePatch())).toEqual(edited);
    await page.getByRole('link', { name: 'Open in rack', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.locator('#contentView')).toBeHidden();
    expect(await page.evaluate(() => window.eurorackApp === window.originalRackApp)).toBe(true);
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => page.evaluate(id => window.eurorackApp.state.getModule(id).params.volume, outputId)).toBe(demo.state.params[outputId].volume);
});

test('hero uses equal uppercase type and cached retina images sized for each viewport', async ({ browser }) => {
    const manifest = JSON.parse(await readFile('src/patch-previews/introduction/manifest.json', 'utf8'));
    for (const width of [390, 1440, 1920]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 2 });
        const page = await context.newPage();
        await page.goto(test.info().project.use.baseURL + '/introduction');
        await page.evaluate(() => document.fonts.ready);
        const title = page.locator('#marketing-title'), tagline = page.locator('.marketing-tagline');
        await expect(title).toHaveCSS('text-transform', 'uppercase');
        await expect(tagline).toHaveCSS('text-transform', 'uppercase');
        const fontSize = await title.evaluate(node => getComputedStyle(node).fontSize);
        await expect(tagline).toHaveCSS('font-size', fontSize);
        const image = page.locator('.marketing-rack img');
        await expect(image).toBeVisible();
        await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
        const details = await image.evaluate(node => ({ url: node.currentSrc, width: node.getBoundingClientRect().width, dpr: devicePixelRatio }));
        const variant = manifest.variants.find(item => details.url.endsWith(item.file));
        expect(variant).toBeDefined();
        expect(variant.width).toBeGreaterThanOrEqual(Math.ceil(details.width * details.dpr));
        expect(variant.bytes).toBeLessThan(400 * 1024);
        const response = await page.request.get(details.url);
        expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.reload();
        await expect.poll(() => image.evaluate(node => node.complete)).toBe(true);
        expect(await page.evaluate(url => performance.getEntriesByName(url)[0]?.transferSize, details.url)).toBe(0);
        await context.close();
    }
});

test('social crawlers receive public cached cards from the initial HTML', async ({ request }) => {
    const manifest = JSON.parse(await readFile('src/social-cards/manifest.json', 'utf8'));
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()['content-type']).toContain('application/xml');
    const sitemapText = await sitemap.text();
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('Sitemap: https://eurorackjs.orderandchaos.xyz/sitemap.xml');
    for (const [path, card] of Object.entries(manifest.cards)) {
        const response = await request.get(path, { headers: { 'User-Agent': 'Twitterbot/1.0' } });
        expect(response.status()).toBe(200);
        const html = await response.text();
        const canonical = `https://eurorackjs.orderandchaos.xyz${path}`;
        expect(sitemapText).toContain(`<loc>${canonical}</loc>`);
        expect(html).toContain(`<link rel="canonical" href="${canonical}">`);
        expect(html).toContain(`<meta property="og:url" content="${canonical}">`);
        expect(html).toContain('<meta name="robots" content="index, follow, max-image-preview:large">');
        const imageUrl = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
        expect(imageUrl).toBe(`https://eurorackjs.orderandchaos.xyz/social-cards/${card.file}`);
        expect(html).toContain(`<meta name="twitter:image" content="${imageUrl}">`);
        expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
        const image = await request.get(new URL(imageUrl).pathname, { headers: { 'User-Agent': 'Twitterbot/1.0' } });
        expect(image.status()).toBe(200);
        expect(image.headers()['content-type']).toBe('image/png');
        expect(image.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
        expect((await image.body()).length).toBe(card.bytes);
    }
    const catalogue = await request.get('/patches');
    expect(catalogue.status()).toBe(200);
    expect(await catalogue.text()).not.toContain(manifest.cards['/'].file);
});

test('rack hints and page headings load their own cached Space Grotesk weights on demand', async ({ page }) => {
    const fontResponses = [];
    const socialCardRequests = [];
    page.on('request', request => {
        if (new URL(request.url()).pathname.startsWith('/social-cards/')) socialCardRequests.push(request.url());
    });
    page.on('response', response => {
        if (response.request().resourceType() === 'font') fontResponses.push(response);
    });
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.patchWorkbench);
    await page.evaluate(() => document.fonts.ready);
    expect(fontResponses).toHaveLength(1);
    expect(fontResponses[0].url()).toMatch(/\/fonts\/space-grotesk-regular-latin\.[a-f0-9]{8}\.woff2$/);
    await expect(page.locator('.cable-hints')).toHaveCSS('font-weight', '400');
    await expect(page.locator('.cable-hints')).toHaveCSS('font-size', '9px');
    await expect(page.locator('.cable-hints')).toHaveCSS('line-height', '12.15px');

    await page.locator('[data-content-view="docs"]').click();
    await expect(page.locator('#contentView h1')).toHaveText('Documentation');
    await page.evaluate(() => document.fonts.ready);
    expect(fontResponses).toHaveLength(2);
    const bold = fontResponses[1];
    expect(bold.url()).toMatch(/\/fonts\/space-grotesk-bold-latin\.[a-f0-9]{8}\.woff2$/);
    for (const font of fontResponses) {
        expect(new URL(font.url()).origin).toBe(new URL(page.url()).origin);
        expect(font.status()).toBe(200);
        expect(await font.headerValue('content-type')).toBe('font/woff2');
        expect(await font.headerValue('cache-control')).toBe('public, max-age=31536000, immutable');
        expect((await font.body()).byteLength).toBeLessThan(16 * 1024);
    }
    expect(await page.evaluate(() => [...document.fonts].some(face => face.family.includes('Space Grotesk') && face.status === 'loaded'))).toBe(true);
    await expect(page.locator('#contentView h1')).toHaveCSS('font-weight', '700');
    await expect(page.locator('#contentView h1')).toHaveCSS('font-family', /Space Grotesk/);
    await expect(page.locator('#contentView .docs-intro')).toHaveCSS('font-family', /Courier/);

    await page.locator('[data-content-view="introduction"]').click();
    await expect(page.locator('#contentView h1')).toHaveText('EurorackJS');
    await page.evaluate(() => document.fonts.ready);
    expect(fontResponses).toHaveLength(2);

    for (const path of ['/docs', '/introduction']) {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('link[rel="preload"][as="font"]')).toHaveAttribute('href', new URL(bold.url()).pathname);
        const timing = await page.evaluate(fontUrl => performance.getEntriesByName(fontUrl).map(entry => ({
            transferred: entry.transferSize, decoded: entry.decodedBodySize
        })), bold.url());
        expect(timing).toHaveLength(1);
        expect(timing[0].decoded).toBeGreaterThan(0);
        expect(timing[0].transferred).toBe(0);
    }
    expect(socialCardRequests).toHaveLength(0);
});
