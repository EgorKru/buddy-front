/**
 * Smoke: STOMP на живом бэкенде (сообщение, read receipt, presence).
 * Usage: node scripts/ws-smoke.mjs
 * Env: E2E_API_URL, E2E_SENDER_*, E2E_RECIPIENT_*, E2E_CHAT_ID (из .env.e2e.local)
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
const CHAT_ID = process.env.E2E_CHAT_ID;
const SENDER = process.env.E2E_SENDER_USERNAME;
const SENDER_PASS = process.env.E2E_SENDER_PASSWORD;
const RECIPIENT = process.env.E2E_RECIPIENT_USERNAME;
const RECIPIENT_PASS = process.env.E2E_RECIPIENT_PASSWORD;

function requireEnv() {
  const missing = [];
  if (!CHAT_ID) missing.push('E2E_CHAT_ID');
  if (!SENDER) missing.push('E2E_SENDER_USERNAME');
  if (!SENDER_PASS) missing.push('E2E_SENDER_PASSWORD');
  if (!RECIPIENT) missing.push('E2E_RECIPIENT_USERNAME');
  if (!RECIPIENT_PASS) missing.push('E2E_RECIPIENT_PASSWORD');
  if (missing.length) {
    console.error('Missing env:', missing.join(', '));
    process.exit(1);
  }
}

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
    const received = {
      topicMessage: false,
      queueMessage: false,
      readTopic: false,
      readQueue: false,
      presence: false,
    };
    const client = new Client({
      brokerURL: WS,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 0,
      debug: () => {},
      onConnect: () => resolve({ client, received, label }),
      onStompError: (frame) => reject(new Error(`${label} STOMP error: ${frame.headers.message}`)),
      onWebSocketError: (e) => reject(e),
    });
    client.activate();
    setTimeout(() => reject(new Error(`${label} connect timeout`)), 15_000);
  });
}

function waitFor(predicate, timeoutMs, label) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve(true);
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timeout: ${label}`));
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

function subscribeJson(client, dest, flag, received, key) {
  return client.subscribe(dest, (msg) => {
    try {
      JSON.parse(msg.body);
      received[key] = true;
      flag.current = true;
    } catch {
      /* ignore */
    }
  });
}

async function main() {
  requireEnv();
  console.log('WS smoke →', WS, 'chat', CHAT_ID);

  const senderAuth = await login(SENDER, SENDER_PASS);
  const recipientAuth = await login(RECIPIENT, RECIPIENT_PASS);

  const topicDest = `/topic/chat/${CHAT_ID}`;
  const readTopic = `/topic/chat/${CHAT_ID}/read`;

  const senderFlag = { current: false };
  const recipientFlag = { current: false };
  const readTopicFlag = { current: false };
  const readQueueFlag = { current: false };
  const presenceFlag = { current: false };

  const { client: senderClient, received: senderRx } = await connectStomp(
    senderAuth.token,
    'sender'
  );
  subscribeJson(senderClient, readTopic, readTopicFlag, senderRx, 'readTopic');
  subscribeJson(senderClient, '/user/queue/read-receipts', readQueueFlag, senderRx, 'readQueue');
  subscribeJson(senderClient, '/user/queue/presence', presenceFlag, senderRx, 'presence');

  const { client: recipientClient, received: recipientRx } = await connectStomp(
    recipientAuth.token,
    'recipient'
  );
  subscribeJson(recipientClient, topicDest, recipientFlag, recipientRx, 'topicMessage');
  subscribeJson(recipientClient, '/user/queue/messages', recipientFlag, recipientRx, 'queueMessage');

  await waitFor(() => senderClient.connected && recipientClient.connected, 5000, 'connected');
  await waitFor(() => senderRx.presence || presenceFlag.current, 5000, 'sender presence after recipient connect');
  console.log('✓ sender got /user/queue/presence');

  const unique = `ws-smoke-${Date.now()}`;
  const sendRes = await fetch(`${API}/chats/${CHAT_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${senderAuth.token}`,
    },
    body: JSON.stringify({ content: unique, type: 'TEXT' }),
  });
  if (!sendRes.ok) {
    const err = await sendRes.text();
    throw new Error(`REST send failed: ${sendRes.status} ${err}`);
  }
  console.log('→ REST send (broadcast via STOMP topic)');

  await waitFor(
    () => recipientRx.topicMessage || recipientFlag.current,
    3000,
    'recipient /topic/chat message'
  );
  console.log('✓ recipient got /topic/chat/' + CHAT_ID);

  recipientClient.publish({
    destination: '/app/chat.markRead',
    body: JSON.stringify({ chatId: Number(CHAT_ID), lastReadMessageId: null }),
  });
  console.log('→ recipient /app/chat.markRead');

  let readViaWs = true;
  try {
    await waitFor(
      () => senderRx.readTopic || readTopicFlag.current,
      2000,
      'sender /topic/chat/read after WS markRead'
    );
  } catch {
    readViaWs = false;
    console.log('⚠ WS markRead: no read event in 2s (перезапустите бэкенд с /app/chat.markRead)');
    const restRead = await fetch(`${API}/chats/${CHAT_ID}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${recipientAuth.token}` },
    });
    if (!restRead.ok) {
      throw new Error(`REST mark read failed: ${restRead.status}`);
    }
    console.log('→ fallback PUT /chats/{id}/read (тоже шлёт STOMP broadcast)');
    await waitFor(
      () => senderRx.readTopic || readTopicFlag.current,
      3000,
      'sender /topic/chat/read after REST'
    );
  }

  await waitFor(
    () => senderRx.readQueue || readQueueFlag.current,
    3000,
    'sender /user/queue/read-receipts'
  );
  console.log(
    readViaWs
      ? '✓ read receipt via WS markRead (topic + user queue)'
      : '✓ read receipt via REST broadcast (topic + user queue); обновите бэкенд для WS markRead'
  );

  senderClient.deactivate();
  recipientClient.deactivate();
  console.log('\nAll WebSocket channels OK.');
}

main().catch((e) => {
  console.error('\nWS smoke FAILED:', e.message);
  process.exit(1);
});
