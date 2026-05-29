/**
 * Smoke: REST + STOMP для группового мита (PRIVATE room + chatId).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@stomp/stompjs';

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
const WS = API.replace(/^http/, 'ws').replace(/\/api$/, '') + '/ws-native';
const GROUP_CHAT_ID = process.env.E2E_GROUP_CHAT_ID;
const SENDER = process.env.E2E_SENDER_USERNAME;
const SENDER_PASS = process.env.E2E_SENDER_PASSWORD;
const RECIPIENT = process.env.E2E_RECIPIENT_USERNAME;
const RECIPIENT_PASS = process.env.E2E_RECIPIENT_PASSWORD;
const OUTSIDER = process.env.E2E_OUTSIDER_USERNAME || 'e2e_outsider';
const OUTSIDER_PASS = process.env.E2E_OUTSIDER_PASSWORD || 'password123';

async function login(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message || `Login ${username} failed: ${res.status}`);
  return body;
}

function connectStomp(token, label) {
  return new Promise((resolve, reject) => {
    const client = new Client({
      brokerURL: WS,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 0,
      debug: () => {},
      onConnect: () => resolve(client),
      onStompError: (frame) => reject(new Error(`${label} STOMP error: ${frame.headers.message}`)),
      onWebSocketError: (e) => reject(e),
    });
    client.activate();
    setTimeout(() => reject(new Error(`${label} connect timeout`)), 15_000);
  });
}

async function createPrivateMeet(token, chatId) {
  const res = await fetch(`${API}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title: 'Smoke Meet', type: 'PRIVATE', chatId: Number(chatId) }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Create room failed: ${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function joinMeet(token, roomId) {
  const res = await fetch(`${API}/rooms/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ roomId }),
  });
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  if (!SENDER || !SENDER_PASS || !RECIPIENT || !RECIPIENT_PASS || !GROUP_CHAT_ID) {
    console.error('Missing E2E env. Run: npm run test:e2e:setup');
    process.exit(1);
  }

  console.log('Room smoke →', WS);

  const hostAuth = await login(SENDER, SENDER_PASS);
  const memberAuth = await login(RECIPIENT, RECIPIENT_PASS);
  let outsiderAuth;
  try {
    outsiderAuth = await login(OUTSIDER, OUTSIDER_PASS);
  } catch {
    outsiderAuth = null;
  }

  const room = await createPrivateMeet(hostAuth.token, GROUP_CHAT_ID);
  console.log('✓ created PRIVATE meet', room.roomId);

  const memberJoin = await joinMeet(memberAuth.token, room.roomId);
  if (!memberJoin.ok) throw new Error(`Member join failed: ${memberJoin.status}`);
  console.log('✓ member joined');

  if (outsiderAuth) {
    const outsiderJoin = await joinMeet(outsiderAuth.token, room.roomId);
    if (outsiderJoin.status !== 403) {
      throw new Error(`Expected outsider 403, got ${outsiderJoin.status}`);
    }
    console.log('✓ outsider join denied (403)');
  }

  const host = await connectStomp(hostAuth.token, 'host');
  const member = await connectStomp(memberAuth.token, 'member');

  let hostEvent = null;
  host.subscribe(`/topic/room/${room.roomId}`, (msg) => {
    try {
      hostEvent = JSON.parse(msg.body);
    } catch {
      /* ignore */
    }
  });

  await new Promise((r) => setTimeout(r, 1000));

  const endRes = await fetch(`${API}/rooms/${room.roomId}/end`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hostAuth.token}` },
  });
  if (!endRes.ok) throw new Error(`End room failed: ${endRes.status}`);
  console.log('→ end room');

  const start = Date.now();
  while (!hostEvent && Date.now() - start < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (hostEvent?.eventType !== 'ROOM_ENDED') {
    throw new Error(`Expected ROOM_ENDED, got ${hostEvent?.eventType || 'timeout'}`);
  }
  console.log('✓ host got ROOM_ENDED');

  const rejoin = await joinMeet(memberAuth.token, room.roomId);
  if (rejoin.status !== 400) {
    throw new Error(`Expected 400 re-join ended room, got ${rejoin.status}`);
  }
  console.log('✓ re-join ended room rejected (400)');

  host.deactivate();
  member.deactivate();
  console.log('\nAll room channels OK.');
}

main().catch((e) => {
  console.error('\nRoom smoke FAILED:', e.message);
  process.exit(1);
});
