/**
 * Direct-чаты, текст: ECDH P-256 + HKDF + AES-256-GCM.
 * Включается: NEXT_PUBLIC_E2EE_ENABLED=true
 */
import { cryptoAPI } from '@/shared/api/crypto';

const HKDF_INFO = new TextEncoder().encode('pager-direct-text-e2ee-v1');
const DB_NAME = 'pager-e2ee';
const STORE = 'kv';
const E2EE_VERSION = 1;

const spkiCache = new Map();

export const E2EE_LOCAL_KEY_LOST = 'E2EE_LOCAL_KEY_LOST';

export function clearPeerSpkiCache(peerUserId) {
  if (peerUserId != null) {
    spkiCache.delete(String(peerUserId));
  } else {
    spkiCache.clear();
  }
}

/**
 * Явно выключить: NEXT_PUBLIC_E2EE_ENABLED=false (или 0).
 * Явно включить: true / 1.
 * Если переменная не задана — как в next.config: только в development по умолчанию включено
 * (в test/production без флага — выкл., чтобы Jest и prod-поведение были предсказуемы).
 */
export function isE2eeEnabled() {
  const v = process.env.NEXT_PUBLIC_E2EE_ENABLED;
  if (v === 'false' || v === '0') return false;
  if (v === 'true' || v === '1') return true;
  if (v != null && String(v).trim() !== '') return false;
  return process.env.NODE_ENV === 'development';
}

function bytesToB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getCurrentUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.id != null ? Number(u.id) : null;
  } catch {
    return null;
  }
}

async function exportPublicSpkiB64(publicKey) {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  return bytesToB64(new Uint8Array(spki));
}

async function importPeerPublicFromSpkiB64(b64) {
  const raw = b64ToBytes(b64);
  return crypto.subtle.importKey('spki', raw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

async function hkdfAes256GcmKey(sharedBits) {
  const keyMaterial = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: HKDF_INFO,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function deriveSharedAes(myPrivateKey, peerPublicKey) {
  const bits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    myPrivateKey,
    256
  );
  return hkdfAes256GcmKey(bits);
}

/**
 * Локальная пара + публикация SPKI на сервер (при необходимости повторная отправка).
 */
export async function ensureIdentityKeyPublished() {
  if (!isE2eeEnabled() || typeof window === 'undefined' || !crypto?.subtle) return;
  const userId = getCurrentUserId();
  if (!userId) return;

  const storageKey = `ecdh-${userId}`;
  let rec = await idbGet(storageKey);

  if (!rec?.privJwk) {
    let serverHasKey = false;
    try {
      const dto = await cryptoAPI.getUserIdentityKey(userId);
      serverHasKey = Boolean(dto?.identityKeyPublic);
    } catch {
      serverHasKey = false;
    }
    if (serverHasKey) {
      throw new Error(E2EE_LOCAL_KEY_LOST);
    }

    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const privJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const spkiB64 = await exportPublicSpkiB64(pair.publicKey);
    rec = { privJwk, spkiB64 };
    await idbSet(storageKey, rec);
    await cryptoAPI.putMyIdentityKey(spkiB64);
    return;
  }

  try {
    await cryptoAPI.getUserIdentityKey(userId);
  } catch {
    await cryptoAPI.putMyIdentityKey(rec.spkiB64);
  }
}

async function loadMyPrivateKey() {
  const userId = getCurrentUserId();
  if (!userId) return null;
  const rec = await idbGet(`ecdh-${userId}`);
  if (!rec?.privJwk) return null;
  return crypto.subtle.importKey('jwk', rec.privJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
}

async function getPeerSpkiB64(peerUserId, { refresh = false } = {}) {
  const k = String(peerUserId);
  if (refresh) spkiCache.delete(k);
  if (spkiCache.has(k)) return spkiCache.get(k);
  const dto = await cryptoAPI.getUserIdentityKey(peerUserId);
  const b64 = dto?.identityKeyPublic;
  if (!b64) throw new Error('Peer identity key missing');
  spkiCache.set(k, b64);
  return b64;
}

/**
 * @param {number} peerUserId
 * @param {string} plainText
 * @returns {Promise<{ content: string, encryptionVersion: number }|null>}
 */
export async function encryptDirectText(peerUserId, plainText) {
  if (!isE2eeEnabled() || typeof window === 'undefined' || !crypto?.subtle) return null;
  if (!peerUserId || plainText == null) return null;

  await ensureIdentityKeyPublished();
  const myPrivate = await loadMyPrivateKey();
  if (!myPrivate) return null;

  let peerPub;
  try {
    peerPub = await importPeerPublicFromSpkiB64(
      await getPeerSpkiB64(peerUserId, { refresh: true })
    );
  } catch {
    return null;
  }

  const aesKey = await deriveSharedAes(myPrivate, peerPub);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plainText);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc);
  const envelope = {
    v: E2EE_VERSION,
    iv: bytesToB64(iv),
    ct: bytesToB64(new Uint8Array(ct)),
  };
  return {
    content: JSON.stringify(envelope),
    encryptionVersion: E2EE_VERSION,
  };
}

/**
 * @param {number} otherUserId — ECDH-собеседник (для входящего: senderId; для исходящего: peer в direct)
 * @param {string} content — JSON конверт
 */
async function decryptDirectTextOnce(otherUserId, content, { refreshPeerKey = false } = {}) {
  let envelope;
  try {
    envelope = JSON.parse(content);
  } catch {
    throw new Error('Invalid envelope');
  }
  if (envelope.v !== E2EE_VERSION || !envelope.iv || !envelope.ct) {
    throw new Error('Unsupported envelope');
  }

  const myPrivate = await loadMyPrivateKey();
  if (!myPrivate) throw new Error('No local E2EE key');

  const peerPub = await importPeerPublicFromSpkiB64(
    await getPeerSpkiB64(otherUserId, { refresh: refreshPeerKey })
  );
  const aesKey = await deriveSharedAes(myPrivate, peerPub);
  const iv = b64ToBytes(envelope.iv);
  const ct = b64ToBytes(envelope.ct);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  return new TextDecoder().decode(plainBuf);
}

/**
 * @param {number} otherUserId — ECDH-собеседник (для входящего: senderId; для исходящего: peer в direct)
 * @param {string} content — JSON конверт
 */
export async function decryptDirectText(otherUserId, content) {
  if (!isE2eeEnabled() || typeof window === 'undefined' || !crypto?.subtle) {
    throw new Error('E2EE unavailable');
  }
  if (!otherUserId) throw new Error('Missing peer id');

  await ensureIdentityKeyPublished();

  try {
    return await decryptDirectTextOnce(otherUserId, content);
  } catch (firstError) {
    try {
      return await decryptDirectTextOnce(otherUserId, content, { refreshPeerKey: true });
    } catch {
      throw firstError;
    }
  }
}
