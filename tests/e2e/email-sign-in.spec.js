import { expect, test } from '@playwright/test';

test('email sign-in resumes an unsaved rack in the original tab and requires confirmation in the email tab', async ({ context, page }) => {
    const methods = { google: false, magicLink: true };
    await context.route('**/api/config', route => route.fulfill({ json: { enabled: true, authMethods: methods } }));
    let sent, verified;
    await context.route('**/api/auth/sign-in/magic-link', route => {
        sent = route.request().postDataJSON();
        return route.fulfill({ json: { status: true } });
    });
    await context.route('**/api/auth/magic-link/confirm', async route => {
        verified = route.request().postDataJSON();
        await context.addCookies([{ name: 'eurorack-test-user', value: 'alice', url: 'http://127.0.0.1:4176' }]);
        return route.fulfill({ json: { status: true } });
    });
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.patchLibrary?.config.enabled);
    await page.locator('#patchName').fill('Unsaved patch');
    await page.locator('#savePatch').click();
    await page.getByRole('button', { name: 'Sign in to save to your account' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign in', exact: true });
    await expect(dialog.getByRole('button', { name: 'Continue with Google' })).toBeHidden();
    await dialog.getByLabel('Email address').fill('fixture@example.org');
    await dialog.getByRole('button', { name: 'Email me a sign-in link' }).click();
    await expect(page.locator('#patchNotice')).toContainText('Check your inbox');
    expect(sent).toEqual({ email: 'fixture@example.org' });
    await expect(page.locator('#patchAccount')).toHaveText('Sign in');
    const email = await context.newPage();
    await email.goto('/email-sign-in.html#token=mailbox-proof');
    await expect(email).toHaveURL(/\/email-sign-in\.html$/);
    expect(verified).toBeUndefined();
    await email.getByRole('button', { name: 'Sign in to Eurorack JS' }).click();
    await expect(email).toHaveURL('http://127.0.0.1:4176/');
    expect(verified).toEqual({ token: 'mailbox-proof' });
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('#patchAccount')).toHaveText('Sign out');
    const save = page.getByRole('dialog', { name: 'Save patch' });
    await expect(save.getByLabel('Save to')).toHaveValue('cloud');
    await expect(save.getByLabel('Patch name')).toHaveValue('Unsaved patch');
});

test('an email delivery error allows a retry and keeps the current page', async ({ page }) => {
    await page.route('**/api/config', route => route.fulfill({ json: { enabled: true, authMethods: { google: true, magicLink: true } } }));
    await page.route('**/api/auth/sign-in/magic-link', route => route.fulfill({ status: 503, json: { message: 'Try again later.' } }));
    await page.goto('/introduction');
    await page.locator('#patchAccount').click();
    await page.getByLabel('Email address').fill('fixture@example.org');
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Try again later');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/introduction$/);
});
