import {defineConfig, devices} from '@playwright/test';
import base from './playwright.config.js';

// Opt in with npm run test:webmcp. Use installed Chrome: the bundled Chromium
// can lag behind the experimental API, and a skipped/stubbed test is insufficient.
export default defineConfig({
    ...base,
    testIgnore: [],
    testMatch: '**/webmcp-native.spec.js',
    projects: [{
        name: 'chrome-webmcp',
        use: {...devices['Desktop Chrome'], channel: 'chrome',
            launchOptions: {args: ['--enable-features=WebMCP']}}
    }]
});
