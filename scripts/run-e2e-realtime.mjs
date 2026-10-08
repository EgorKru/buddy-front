import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import processTree from './e2e-process.cjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { manageServer, resolveServerAddress, runNextBuild, runPlaywright, startNextServer } =
  processTree;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    const force =
      key === 'E2E_BASE_URL' ||
      key === 'E2E_CHAT_ID' ||
      key.startsWith('E2E_SENDER_') ||
      key.startsWith('E2E_RECIPIENT_') ||
      key === 'NEXT_PUBLIC_E2EE_ENABLED' ||
      key === 'NEXT_PUBLIC_API_URL' ||
      key === 'NEXT_PUBLIC_WS_URL';
    if (force || process.env[key] == null) process.env[key] = value;
  }
}

function isHealthyHtml(text) {
  return !text.includes('Server Error') && !text.includes('missing required error components');
}

async function waitForHealthy(url, label, deadline) {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (res.ok && isHealthyHtml(text)) {
        console.log(`[e2e] ready: ${label}`);
        return;
      }
    } catch (e) {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timeout waiting for ${label} (${url})`);
}

async function main() {
  loadEnvFile(path.join(root, '.env.e2e.local'));

  process.env.PLAYWRIGHT_TEST = '1';
  process.env.E2E_DISABLE_E2EE = '1';
  process.env.NEXT_PUBLIC_E2EE_ENABLED = 'false';
  process.env.NEXT_PUBLIC_API_URL =
    process.env.NEXT_PUBLIC_API_URL || process.env.E2E_API_URL || 'http://localhost:8080/api';
  process.env.NEXT_PUBLIC_WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8080/ws';
  process.env.NEXT_PUBLIC_WS_NATIVE_URL =
    process.env.NEXT_PUBLIC_WS_NATIVE_URL || 'ws://localhost:8080/ws-native';

  const { port, baseUrl } = resolveServerAddress('3002');
  const nextEnv = { ...process.env, NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-e2e' };

  if (process.env.E2E_SKIP_BUILD !== '1') {
    console.log('[e2e] production build…');
    const build = runNextBuild(root, nextEnv);
    if (build.status !== 0) process.exit(build.status ?? 1);
  }

  console.log('[e2e] starting production server…');
  const server = startNextServer(root, port, nextEnv);
  const serverController = manageServer(server);

  const deadline = Date.now() + Number(process.env.E2E_SERVER_WAIT_MS || 120_000);
  try {
    await waitForHealthy(`${baseUrl}/login`, 'login', deadline);
    const chatId = process.env.E2E_CHAT_ID;
    if (chatId) {
      await waitForHealthy(`${baseUrl}/chat/${chatId}`, `chat/${chatId}`, deadline);
    }
  } catch (e) {
    console.error(e.message);
    serverController.stop();
    process.exit(1);
  }

  process.env.E2E_SKIP_WEB_SERVER = '1';
  process.env.E2E_BASE_URL = baseUrl;

  const tests = runPlaywright(root, ['test', 'e2e/realtime.spec.js'], process.env);

  serverController.stop();
  process.exit(tests.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
