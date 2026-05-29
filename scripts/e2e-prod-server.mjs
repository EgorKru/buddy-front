/**
 * Production-сервер для Playwright E2E (после npm run build в global-setup).
 */
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const port = process.env.PORT || process.env.E2E_PORT || '3002';
const baseUrl = (process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
const loginUrl = `${baseUrl}/login`;
const chatId = process.env.E2E_CHAT_ID;
const deadline = Date.now() + Number(process.env.E2E_SERVER_WAIT_MS || 120_000);

const env = {
  ...process.env,
  PORT: port,
  PLAYWRIGHT_TEST: '1',
  E2E_DISABLE_E2EE: '1',
  NEXT_PUBLIC_E2EE_ENABLED: 'false',
};

const server = spawn('npm', ['run', 'start', '--', '-p', port], {
  env,
  stdio: 'inherit',
  shell: true,
});

server.on('exit', (code) => process.exit(code ?? 1));

function isHealthyHtml(text) {
  return !text.includes('Server Error') && !text.includes('missing required error components');
}

async function waitForUrl(url, label) {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (res.ok && isHealthyHtml(text)) {
        console.log(`[e2e-prod-server] ready: ${label} (${url})`);
        return;
      }
    } catch {
      // starting
    }
    await sleep(1000);
  }
  console.error(`[e2e-prod-server] timeout: ${label}`);
  server.kill();
  process.exit(1);
}

await waitForUrl(loginUrl, 'login');
if (chatId) {
  await waitForUrl(`${baseUrl}/chat/${chatId}`, `chat/${chatId}`);
}

process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});
process.on('SIGTERM', () => {
  server.kill();
  process.exit(0);
});
