import { defineConfig } from '@playwright/test';

/**
 * Playwright cannot download browsers here — the egress proxy blocks
 * cdn.playwright.dev — so the already-installed Chromium is pointed at
 * directly. See BROWSER-TESTING.md.
 */
const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = Number(process.env.E2E_PORT ?? 4288);

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 950 },
    launchOptions: { executablePath: CHROMIUM, args: ['--no-sandbox'] },
    trace: 'off',
  },
  webServer: {
    // The bracket keeps the pattern from matching this command line itself; it
    // clears a preview server left behind by an interrupted run, which would
    // otherwise either fail --strictPort or serve a stale build.
    command:
      `pkill -f "[v]ite preview --port ${PORT}" ; ` +
      `npm run build && npx vite preview --port ${PORT} --host 127.0.0.1 --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
