/**
 * Подготовка .env.e2e.local: два пользователя + DIRECT-чат.
 * Требует бэкенд с профилем local-dev (POST /api/auth/dev-register).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API = process.env.E2E_API_URL || 'http://localhost:8080/api';
const PASSWORD = 'password123';
const SENDER = process.env.E2E_SENDER_USERNAME || 'e2e_sender';
const RECIPIENT = process.env.E2E_RECIPIENT_USERNAME || 'e2e_recipient';
const OUTSIDER = process.env.E2E_OUTSIDER_USERNAME || 'e2e_outsider';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.e2e.local');

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = new Error(typeof body === 'object' ? JSON.stringify(body) : text);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function devRegisterOrLogin(username, displayName) {
  const email = `${username}@e2e.test`;
  try {
    return await request(`${API}/auth/dev-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password: PASSWORD, displayName }),
    });
  } catch (e) {
    if (e.status === 400 || e.status === 409) {
      return request(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: PASSWORD }),
      });
    }
    throw e;
  }
}

async function findOrCreateDirectChat(senderToken, recipientId) {
  const chats = await request(`${API}/chats`, {
    headers: { Authorization: `Bearer ${senderToken}` },
  });
  const existing = Array.isArray(chats)
    ? chats.find(
        (c) =>
          String(c.type).toUpperCase() === 'DIRECT' &&
          Array.isArray(c.participants) &&
          c.participants.some((p) => Number(p.id) === Number(recipientId))
      )
    : null;
  if (existing?.id) return existing;

  return request(`${API}/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${senderToken}`,
    },
    body: JSON.stringify({ type: 'DIRECT', participantIds: [recipientId] }),
  });
}

async function findOrCreateGroupChat(senderToken, participantIds) {
  const chats = await request(`${API}/chats`, {
    headers: { Authorization: `Bearer ${senderToken}` },
  });
  const ids = new Set(participantIds.map(Number));
  const existing = Array.isArray(chats)
    ? chats.find((c) => {
        if (String(c.type).toUpperCase() !== 'GROUP' || !Array.isArray(c.participants)) {
          return false;
        }
        const chatIds = new Set(c.participants.map((p) => Number(p.id)));
        return [...ids].every((id) => chatIds.has(id));
      })
    : null;
  if (existing?.id) return existing;

  return request(`${API}/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${senderToken}`,
    },
    body: JSON.stringify({
      type: 'GROUP',
      name: 'E2E Meet Group',
      participantIds,
    }),
  });
}

async function main() {
  console.log('E2E setup: API', API);

  const senderAuth = await devRegisterOrLogin(SENDER, 'E2E Sender');
  const recipientAuth = await devRegisterOrLogin(RECIPIENT, 'E2E Recipient');
  await devRegisterOrLogin(OUTSIDER, 'E2E Outsider');

  const chat = await findOrCreateDirectChat(senderAuth.token, recipientAuth.user.id);
  const groupChat = await findOrCreateGroupChat(senderAuth.token, [recipientAuth.user.id]);

  const e2ePort = process.env.E2E_PORT || '3002';
  const lines = [
    `E2E_BASE_URL=${process.env.E2E_BASE_URL || `http://localhost:${e2ePort}`}`,
    `E2E_API_URL=${API}`,
    `NEXT_PUBLIC_API_URL=${API}`,
    `NEXT_PUBLIC_WS_URL=${API.replace(/\/api$/, '')}/ws`,
    `E2E_SENDER_USERNAME=${SENDER}`,
    `E2E_SENDER_PASSWORD=${PASSWORD}`,
    `E2E_RECIPIENT_USERNAME=${RECIPIENT}`,
    `E2E_RECIPIENT_PASSWORD=${PASSWORD}`,
    `E2E_OUTSIDER_USERNAME=${OUTSIDER}`,
    `E2E_OUTSIDER_PASSWORD=${PASSWORD}`,
    `E2E_CHAT_ID=${chat.id}`,
    `E2E_GROUP_CHAT_ID=${groupChat.id}`,
    'NEXT_PUBLIC_E2EE_ENABLED=false',
    'E2E_REALTIME_MS=8000',
    '',
  ];

  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  console.log('Wrote', envPath);
  console.log('Direct chat id:', chat.id);
  console.log('Group chat id:', groupChat.id);
  console.log('Sender:', SENDER, 'id', senderAuth.user.id);
  console.log('Recipient:', RECIPIENT, 'id', recipientAuth.user.id);
  console.log('Outsider:', OUTSIDER);
}

main().catch((e) => {
  console.error('E2E setup failed:', e.message || e);
  process.exit(1);
});
