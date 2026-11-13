import { readFile } from 'node:fs/promises';
import { patchHead } from './html.js';

let shell;
export async function rackPage(patch, baseUrl, patchId) {
    shell ||= readFile(new URL('../src/index.html', import.meta.url), 'utf8').catch(error => {
        shell = null;
        throw error;
    });
    // Only anonymous public metadata reaches HTML; the editor loads the saved
    // state separately through the authenticated API, including for owners.
    return (await shell).replace(/<title>[^<]*<\/title>/, () => patchHead(patch, baseUrl, patchId));
}
