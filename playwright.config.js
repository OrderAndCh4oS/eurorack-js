import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    // The development server serves the unbundled module graph. Serial pages
    // prevent connection resets when each context requests every module at once.
    workers: 1,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'on-first-retry'
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
    ],
    webServer: {
        command: 'python3 -m http.server 4173 --directory src',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI
    }
});
