/**
 * Round-trip и ошибки direct-text E2EE (Web Crypto + IndexedDB).
 */
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

import { encryptDirectText, decryptDirectText, isE2eeEnabled } from '../directTextE2ee';
import { cryptoAPI } from '@/shared/api/crypto';

jest.mock('@/shared/api/crypto', () => ({
  cryptoAPI: {
    putMyIdentityKey: jest.fn().mockResolvedValue(undefined),
    getUserIdentityKey: jest.fn(),
  },
}));

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const DB_NAME = 'pager-e2ee';
const STORE = 'kv';

async function deleteTestDb() {
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

function bytesToB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

async function createEcdhRecord() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const privJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  return { privJwk, spkiB64: bytesToB64(new Uint8Array(spki)) };
}

async function seedIdentity(userId, { privJwk, spkiB64 }) {
  await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ privJwk, spkiB64 }, `ecdh-${userId}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

describe('directTextE2ee', () => {
  const prevE2ee = process.env.NEXT_PUBLIC_E2EE_ENABLED;

  beforeEach(async () => {
    await deleteTestDb();
    localStorage.clear();
    jest.clearAllMocks();
    cryptoAPI.putMyIdentityKey.mockResolvedValue(undefined);
    process.env.NEXT_PUBLIC_E2EE_ENABLED = 'true';
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_E2EE_ENABLED = prevE2ee;
  });

  it('isE2eeEnabled is false without env flag', () => {
    process.env.NEXT_PUBLIC_E2EE_ENABLED = '';
    expect(isE2eeEnabled()).toBe(false);
  });

  it('isE2eeEnabled is true when flag is "true"', () => {
    expect(isE2eeEnabled()).toBe(true);
  });

  it('encryptDirectText returns null without peer id', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1 }));
    expect(await encryptDirectText(null, 'x')).toBeNull();
    expect(await encryptDirectText(0, 'x')).toBeNull();
  });

  it('encryptDirectText returns null when peer key is missing', async () => {
    const alice = await createEcdhRecord();
    await seedIdentity(501, alice);
    localStorage.setItem('user', JSON.stringify({ id: 501 }));
    cryptoAPI.getUserIdentityKey.mockRejectedValue(new Error('404'));

    const out = await encryptDirectText(502, 'hi');
    expect(out).toBeNull();
  });

  it('encrypt and decrypt round-trip between two users', async () => {
    const alice = await createEcdhRecord();
    const bob = await createEcdhRecord();
    await seedIdentity(601, alice);
    await seedIdentity(602, bob);

    const spkiByUser = {
      601: alice.spkiB64,
      602: bob.spkiB64,
    };
    cryptoAPI.getUserIdentityKey.mockImplementation((uid) =>
      Promise.resolve({ identityKeyPublic: spkiByUser[uid] })
    );

    localStorage.setItem('user', JSON.stringify({ id: 601 }));
    const encrypted = await encryptDirectText(602, 'hello привет');
    expect(encrypted).not.toBeNull();
    expect(encrypted.encryptionVersion).toBe(1);
    expect(JSON.parse(encrypted.content).v).toBe(1);

    localStorage.setItem('user', JSON.stringify({ id: 602 }));
    const plain = await decryptDirectText(601, encrypted.content);
    expect(plain).toBe('hello привет');
  });

  it('decryptDirectText throws when E2EE is off', async () => {
    process.env.NEXT_PUBLIC_E2EE_ENABLED = '';
    await expect(decryptDirectText(1, '{}')).rejects.toThrow(/E2EE unavailable/);
  });

  it('decryptDirectText throws on invalid envelope', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1 }));
    await expect(decryptDirectText(2, 'not-json')).rejects.toThrow(/Invalid envelope/);
    await expect(decryptDirectText(2, JSON.stringify({ v: 9 }))).rejects.toThrow(
      /Unsupported envelope/
    );
  });

  it('decryptDirectText fails when ciphertext was tampered (wrong AES key)', async () => {
    const alice = await createEcdhRecord();
    const bob = await createEcdhRecord();
    const eve = await createEcdhRecord();
    await seedIdentity(701, alice);
    await seedIdentity(702, bob);

    cryptoAPI.getUserIdentityKey.mockImplementation((uid) => {
      const map = { 701: alice.spkiB64, 702: bob.spkiB64 };
      return Promise.resolve({ identityKeyPublic: map[uid] });
    });

    localStorage.setItem('user', JSON.stringify({ id: 701 }));
    const encrypted = await encryptDirectText(702, 'secret');
    expect(encrypted).not.toBeNull();

    cryptoAPI.getUserIdentityKey.mockImplementation((uid) => {
      const map = { 701: eve.spkiB64, 702: bob.spkiB64 };
      return Promise.resolve({ identityKeyPublic: map[uid] });
    });

    localStorage.setItem('user', JSON.stringify({ id: 702 }));
    await expect(decryptDirectText(701, encrypted.content)).rejects.toThrow();
  });
});
