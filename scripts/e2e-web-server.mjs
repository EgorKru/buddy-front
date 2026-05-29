/**
 * Dev-сервер для Playwright: ждёт готовности /login, затем держит процесс.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { setTimeout as sleep } from 'timers/promises';

const nextDir = path.join(process.cwd(), '.next');
if (fs.existsSync(nextDir) && process.env.E2E_CLEAN_NEXT !== '0') {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('[e2e-web-server] removed stale .next');
}

const port = process.env.PORT || process.env.E2E_PORT || '3002';
const baseUrl = process.env.E2E_BASE_URL || `http://localhost:${port}`;
const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`;
const deadline = Date.now() + Number(process.env.E2E_SERVER_WAIT_MS || 180_000);

const env = {
  ...process.env,
  PORT: port,
  PLAYWRIGHT_TEST: '1',
  E2E_DISABLE_E2EE: '1',
  NEXT_PUBLIC_E2EE_ENABLED: 'false',
  NEXT_PUBLIC_API_URL:
    process.env.NEXT_PUBLIC_API_URL || process.env.E2E_API_URL || 'http://localhost:8080/api',
};

const dev = spawn('npm', ['run', 'dev'], {
  env,
  stdio: 'inherit',
  shell: true,
});

dev.on('exit', (code) => process.exit(code ?? 1));

function isHealthyHtml(text) {
  return (
    !text.includes('missing required error components') &&
    !text.includes('Server Error') &&
    !text.includes('vendor-chunks')
  );
}

async function waitForUrl(url, label) {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (res.ok && isHealthyHtml(text)) {
        console.log(`[e2e-web-server] ready: ${label} (${url})`);
        return;
      }
    } catch {
      // still booting
    }
    await sleep(1500);
  }
  console.error(`[e2e-web-server] timeout waiting for ${label} (${url})`);
  dev.kill();
  process.exit(1);
}

await waitForUrl(loginUrl, 'login');
const chatId = process.env.E2E_CHAT_ID;
if (chatId) {
  await waitForUrl(`${baseUrl.replace(/\/$/, '')}/chat/${chatId}`, `chat/${chatId}`);
}

process.on('SIGINT', () => {
  dev.kill();
  process.exit(0);
});
process.on('SIGTERM', () => {
  dev.kill();
  process.exit(0);
});
