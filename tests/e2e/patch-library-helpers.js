export async function openTestPatch(page, name) {
    await page.locator('[data-patch-view="tests"]').click();
    await page.getByRole('searchbox').fill(name);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.locator(`.patch-entry[data-patch-name=${JSON.stringify(name)}]`).first().getByRole('button', { name: 'Open in rack', exact: true }).click();
    const discard = page.getByRole('button', { name: 'Discard changes', exact: true });
    if (await discard.isVisible()) await discard.click();
    await page.locator('#rackView').waitFor({ state: 'visible' });
}

// Musical examples remain regression fixtures, outside the product catalogue.
export async function openArchivedPatch(page, name) {
    await page.evaluate(async patchName => {
        const { ARCHIVED_DEMO_PATCHES } = await import('/js/config/factory-patches.js');
        await window.eurorackApp.loadPatchState(ARCHIVED_DEMO_PATCHES[patchName].state, { managed: true });
    }, name);
}
