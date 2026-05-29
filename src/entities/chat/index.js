/**
 * Сущность "чат": имя, аватар, превью последнего сообщения, мета прочтений. FSD: entities
 */

import { parseServerDate } from '@/shared/lib/date';

const PREVIEW_MAX_LENGTH = 40;

/**
 * Обрезает строку до maxLength символов, добавляет '...' при обрезке.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(text, maxLength) {
  if (typeof text !== 'string') return '';
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

/**
 * @param {object|null} chat
 * @param {object|null} currentUser
 * @returns {string}
 */
export const getChatName = (chat, currentUser) => {
  if (!chat) return 'Чат';
  if (chat.name) return chat.name;
  if (chat.type === 'DIRECT' && chat.participants) {
    const otherParticipant = chat.participants.find((p) => p.id !== currentUser?.id);
    return otherParticipant?.displayName || otherParticipant?.username || 'Чат';
  }
  return 'Групповой чат';
};

/**
 * @param {object|null} chat
 * @param {object|null} currentUser
 * @returns {string|null}
 */
export const getChatAvatar = (chat, currentUser) => {
  if (!chat) return null;
  if (chat.type === 'DIRECT' && chat.participants) {
    const otherParticipant = chat.participants.find((p) => p.id !== currentUser?.id);
    return otherParticipant?.avatarUrl || null;
  }
  return null;
};

/**
 * Текст превью одного сообщения (список чатов, ответ, пересылка).
 * @param {object} message
 * @param {{ decryptedText?: string }} [options] — расшифрованный текст для E2EE
 * @returns {string}
 */
export const getMessagePreview = (message, options = {}) => {
  const { decryptedText } = options;
  if (!message) return '';
  if (Number(message.encryptionVersion) > 0) {
    if (typeof decryptedText === 'string' && decryptedText.length > 0) {
      return truncate(decryptedText, PREVIEW_MAX_LENGTH);
    }
    return '…';
  }
  if (message.type === 'VOICE' && !message.content) return '🎤 Голосовое сообщение';
  if ((message.type === 'FILE' || message.type === 'IMAGE') && !message.content) {
    if (message.fileName) {
      const icon = message.type === 'IMAGE' ? '📷' : '📎';
      return `${icon} ${truncate(message.fileName, PREVIEW_MAX_LENGTH)}`;
    }
    if (message.fileUrl) {
      const parts = message.fileUrl.split('/');
      const lastPart = parts[parts.length - 1];
      const match = lastPart.match(/^[^.]*\.(.+)$/);
      if (match) {
        const extension = match[1];
        return message.type === 'IMAGE' ? `📷 Изображение.${extension}` : `📎 Файл.${extension}`;
      }
      return message.type === 'IMAGE' ? '📷 Изображение' : '📎 Файл';
    }
    return message.type === 'IMAGE' ? '📷 Изображение' : '📎 Файл';
  }
  if (!message.content) {
    if (message.forwardedFrom?.originalContent) {
      return truncate(message.forwardedFrom.originalContent, PREVIEW_MAX_LENGTH);
    }
    if (message.replyTo?.content) {
      return truncate(message.replyTo.content, PREVIEW_MAX_LENGTH);
    }
    return 'Сообщение';
  }
  return truncate(message.content, PREVIEW_MAX_LENGTH);
};

/**
 * Текст превью последнего сообщения чата (для списка чатов).
 * @param {object} chat — объект чата с lastMessage
 * @param {{ decryptedText?: string }} [options]
 * @returns {string}
 */
export const getLastMessagePreview = (chat, options = {}) =>
  getMessagePreview(chat?.lastMessage, options);

/**
 * Мета о прочтении последнего сообщения: кто из участников (кроме текущего) прочитал.
 * @param {object} chat — объект чата с lastMessage и participants
 * @param {object} user — текущий пользователь (его id исключается из подсчёта)
 * @param {Record<string, Record<string, string>>} [readAtByChatIdByUserId] — карта chatId → { userId: readAt }
 * @returns {{ isRead: boolean, readCount: number, totalOthers: number }}
 */
export const getLastMessageReadMeta = (chat, user, readAtByChatIdByUserId) => {
  const lastMessage = chat?.lastMessage;
  if (!lastMessage?.createdAt || !user?.id) return { isRead: false, readCount: 0, totalOthers: 0 };
  const chatReadMap = readAtByChatIdByUserId?.[String(chat.id)] || {};
  const msgTime = parseServerDate(lastMessage.createdAt)?.getTime();
  if (msgTime == null || Number.isNaN(msgTime))
    return { isRead: false, readCount: 0, totalOthers: 0 };
  const participantIds = Array.isArray(chat?.participants)
    ? chat.participants.map((p) => Number(p?.id)).filter((n) => Number.isFinite(n))
    : [];
  const uniqueParticipantIds = Array.from(new Set(participantIds));
  const totalOthers = Math.max(0, (uniqueParticipantIds.length || 0) - 1);
  const otherReaders = Object.entries(chatReadMap)
    .filter(([rid]) => Number(rid) !== Number(user.id))
    .map(([, readAt]) => parseServerDate(readAt)?.getTime())
    .filter((t) => t != null && !Number.isNaN(t));
  const readCount = otherReaders.reduce(
    (acc, readAtTime) => (readAtTime >= msgTime ? acc + 1 : acc),
    0
  );
  return { isRead: readCount > 0, readCount, totalOthers };
};

/**
 * Онлайн-статус второго участника в личном чате.
 * @param {object} chat
 * @param {object} user — текущий пользователь
 * @returns {boolean}
 */
export const getOtherParticipantOnline = (chat, user) => {
  const presence = getOtherParticipantPresence(chat, user);
  return presence.online;
};

/**
 * Presence второго участника в личном чате.
 * @param {object} chat
 * @param {object} user — текущий пользователь
 * @returns {{ online: boolean, busy: boolean }}
 */
export const getOtherParticipantPresence = (chat, user) => {
  if (!chat?.participants || !user?.id) return { online: false, busy: false };
  if (chat.type !== 'DIRECT') return { online: false, busy: false };
  const other = chat.participants.find((p) => Number(p.id) !== Number(user.id));
  return {
    online: Boolean(other?.online),
    busy: Boolean(other?.online && other?.busy),
  };
};
