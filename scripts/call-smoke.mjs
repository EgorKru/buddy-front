/**
 * Smoke: STOMP-сигналинг 1-on-1 аудиозвонков на живом бэкенде.
 * Usage: node scripts/call-smoke.mjs
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

function waitFor(predicate, timeoutMs, label) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve(true);
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timeout: ${label}`));
      setTimeout(tick, 50);
    };
    tick();
  });
}

function subscribeCallQueues(client, state) {
  client.subscribe('/user/queue/call-signal', (msg) => {
    try {
      state.lastSignal = JSON.parse(msg.body);
    } catch {
      /* ignore */
    }
  });
  client.subscribe('/user/queue/call-events', (msg) => {
    try {
      state.lastEvent = JSON.parse(msg.body);
    } catch {
      /* ignore */
    }
  });
}

function publishSignal(client, body) {
  client.publish({
    destination: '/app/call.signal',
    body: JSON.stringify(body),
  });
}

async function main() {
  requireEnv();
  console.log('Call smoke →', WS);

  const callerAuth = await login(SENDER, SENDER_PASS);
  const calleeAuth = await login(RECIPIENT, RECIPIENT_PASS);

  const caller = await connectStomp(callerAuth.token, 'caller');
  const callee = await connectStomp(calleeAuth.token, 'callee');

  const callerState = { lastSignal: null, lastEvent: null };
  const calleeState = { lastSignal: null, lastEvent: null };
  subscribeCallQueues(caller, callerState);
  subscribeCallQueues(callee, calleeState);

  await waitFor(() => caller.connected && callee.connected, 5000, 'connected');

  publishSignal(caller, {
    type: 'CALL_INITIATE',
    targetUserId: calleeAuth.user.id,
    chatId: CHAT_ID ? Number(CHAT_ID) : null,
    callType: 'AUDIO',
  });
  console.log('→ CALL_INITIATE');

  await waitFor(
    () => callerState.lastSignal?.success && callerState.lastSignal?.call?.status === 'CALLING',
    5000,
    'caller call-signal CALLING'
  );
  const callId = callerState.lastSignal.call.id;
  console.log('✓ caller got call-signal, callId=', callId);

  await waitFor(
    () => calleeState.lastEvent?.eventType === 'INCOMING_CALL',
    5000,
    'callee INCOMING_CALL'
  );
  console.log('✓ callee got INCOMING_CALL');

  publishSignal(callee, { type: 'CALL_ACCEPT', callId });
  console.log('→ CALL_ACCEPT');

  await waitFor(
    () => callerState.lastEvent?.eventType === 'CALL_ACCEPTED',
    5000,
    'caller CALL_ACCEPTED'
  );
  console.log('✓ caller got CALL_ACCEPTED');

  publishSignal(caller, {
    type: 'CALL_OFFER',
    callId,
    sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
  });
  console.log('→ CALL_OFFER');

  await waitFor(
    () => calleeState.lastEvent?.eventType === 'WEBRTC_OFFER',
    5000,
    'callee WEBRTC_OFFER'
  );
  console.log('✓ callee got WEBRTC_OFFER');

  publishSignal(caller, { type: 'CALL_END', callId });
  console.log('→ CALL_END');

  await waitFor(
    () => calleeState.lastEvent?.eventType === 'CALL_ENDED',
    5000,
    'callee CALL_ENDED'
  );
  console.log('✓ callee got CALL_ENDED');

  caller.deactivate();
  callee.deactivate();
  console.log('\nAll call WebSocket channels OK.');
}

main().catch((e) => {
  console.error('\nCall smoke FAILED:', e.message);
  process.exit(1);
});
