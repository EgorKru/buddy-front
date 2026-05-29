/**
 * Расшифровка текста сообщения для превью (список чатов, ответ, пересылка).
 */

import { E2EE_LOCAL_KEY_LOST } from './directTextE2ee';

const DECRYPT_RETRY_DELAYS_MS = [0, 400, 1200];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getDirectPeerUserId(chat, currentUserId) {
  if (!chat || chat.type !== 'DIRECT' || !Array.isArray(chat.participants)) return null;
  const other = chat.participants.find((p) => Number(p.id) !== Number(currentUserId));
  return other?.id != null ? Number(other.id) : null;
}

function resolveDecryptUserId(message, chat, currentUser) {
  if (!message || !currentUser?.id) return null;
  if (Number(message.senderId) === Number(currentUser.id)) {
    return getDirectPeerUserId(chat, currentUser.id);
  }
  return Number(message.senderId);
}

/**
 * @returns {Promise<{ text: string|null, reason?: 'local_key_lost'|'decrypt_failed'|'no_peer' }>}
 */
export async function decryptMessagePlainText(message, chat, currentUser) {
  if (!message || typeof message.content !== 'string' || !message.content.trim()) {
    return { text: null, reason: 'decrypt_failed' };
  }
  if (Number(message.encryptionVersion) <= 0) {
    return { text: message.content };
  }

  const mod = await import('./directTextE2ee');
  if (!mod.isE2eeEnabled()) {
    return { text: message.content };
  }

  const otherUserId = resolveDecryptUserId(message, chat, currentUser);
  if (!otherUserId) {
    return { text: null, reason: 'no_peer' };
  }

  for (let attempt = 0; attempt < DECRYPT_RETRY_DELAYS_MS.length; attempt++) {
    if (DECRYPT_RETRY_DELAYS_MS[attempt] > 0) {
      await delay(DECRYPT_RETRY_DELAYS_MS[attempt]);
    }
    try {
      await mod.ensureIdentityKeyPublished();
      const plain = await mod.decryptDirectText(otherUserId, message.content);
      return { text: plain };
    } catch (err) {
      if (err?.message === E2EE_LOCAL_KEY_LOST) {
        return { text: null, reason: 'local_key_lost' };
      }
    }
  }

  return { text: null, reason: 'decrypt_failed' };
}
