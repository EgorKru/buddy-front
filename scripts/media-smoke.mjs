/**
 * Smoke: TURN credentials для WebRTC должны отдаваться быстро (<500ms).
 * Usage: node scripts/media-smoke.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.e2e.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) process.env[t.slice(0, i)] = t.slice(i + 1);
  }
}

const API = (process.env.E2E_API_URL || 'http://localhost:8080/api').replace(/\/$/, '');
const USER = process.env.E2E_SENDER_USERNAME;
const PASS = process.env.E2E_SENDER_PASSWORD;
const TURN_MAX_MS = Number(process.env.MEDIA_TURN_MAX_MS || 500);

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function main() {
  if (!USER || !PASS) {
    console.error('Set E2E_SENDER_USERNAME and E2E_SENDER_PASSWORD');
    process.exit(1);
  }

  const token = await login();
  const started = performance.now();
  const res = await fetch(`${API}/turn/credentials`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const elapsed = Math.round(performance.now() - started);

  if (!res.ok) {
    console.error(`TURN credentials failed: ${res.status}`);
    process.exit(1);
  }

  const body = await res.json();
  if (!Array.isArray(body.urls) || !body.username || !body.credential) {
    console.error('Invalid TURN payload', body);
    process.exit(1);
  }

  if (elapsed > TURN_MAX_MS) {
    console.error(`TURN too slow: ${elapsed}ms > ${TURN_MAX_MS}ms`);
    process.exit(1);
  }

  console.log(`[media-smoke] TURN credentials OK in ${elapsed}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
