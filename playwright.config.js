// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Опционально: .env.e2e.local с E2E_SENDER_*, E2E_RECIPIENT_*, E2E_CHAT_ID
const e2eEnvPath = path.join(__dirname, '.env.e2e.local');
if (fs.existsSync(e2eEnvPath)) {
  for (const line of fs.readFileSync(e2eEnvPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // Учётные данные и chat id из файла — приоритет над устаревшим shell (E2E_CHAT_ID=1 и т.п.)
    const forceFromFile =
      key === 'E2E_CHAT_ID' ||
      key === 'E2E_BASE_URL' ||
      key.startsWith('E2E_SENDER_') ||
      key.startsWith('E2E_RECIPIENT_') ||
      key === 'NEXT_PUBLIC_E2EE_ENABLED' ||
      key === 'E2E_REALTIME_MS';
    if (forceFromFile || process.env[key] == null) process.env[key] = value;
  }
}

const e2ePort = process.env.E2E_PORT || '3002';
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${e2ePort}`;
const useProdServer = process.env.E2E_PROD_SERVER === '1';

module.exports = defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.js'),
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : {
        command: useProdServer
          ? 'node scripts/e2e-prod-server.mjs'
          : 'node scripts/e2e-web-server.mjs',
        url: `${baseURL}/login`,
        stdout: process.env.E2E_CHAT_ID
          ? new RegExp(
              `\\[e2e-${useProdServer ? 'prod' : 'web'}-server\\] ready: chat/${String(process.env.E2E_CHAT_ID).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
            )
          : new RegExp(`\\[e2e-${useProdServer ? 'prod' : 'web'}-server\\] ready: login`),
        reuseExistingServer: process.env.E2E_REUSE_SERVER === '1',
        timeout: useProdServer ? 300_000 : 240_000,
        env: {
          ...process.env,
          PORT: e2ePort,
          E2E_PORT: e2ePort,
          E2E_DISABLE_E2EE: '1',
          PLAYWRIGHT_TEST: '1',
          NEXT_PUBLIC_PLAYWRIGHT_TEST: '1',
          NEXT_PUBLIC_E2EE_ENABLED: 'false',
          NEXT_PUBLIC_API_URL:
            process.env.NEXT_PUBLIC_API_URL ||
            process.env.E2E_API_URL ||
            'http://localhost:8080/api',
        },
      },
});
