/**
 * Сущность "чат": имя, аватар, превью последнего сообщения, мета прочтений. FSD: entities
 */

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
 * Текст превью последнего сообщения чата (для списка чатов).
 * @param {object} chat — объект чата с lastMessage
 * @returns {string}
 */
export const getLastMessagePreview = (chat) => {
  const lastMessage = chat?.lastMessage;
  if (!lastMessage) return '';
  if (Number(lastMessage.encryptionVersion) > 0) return '🔒 Зашифрованное сообщение';
  if (lastMessage.type === 'VOICE' && !lastMessage.content) return '🎤 Голосовое сообщение';
  if ((lastMessage.type === 'FILE' || lastMessage.type === 'IMAGE') && !lastMessage.content) {
    if (lastMessage.fileName) {
      const icon = lastMessage.type === 'IMAGE' ? '📷' : '📎';
      return `${icon} ${truncate(lastMessage.fileName, PREVIEW_MAX_LENGTH)}`;
    }
    if (lastMessage.fileUrl) {
      const parts = lastMessage.fileUrl.split('/');
      const lastPart = parts[parts.length - 1];
      const match = lastPart.match(/^[^.]*\.(.+)$/);
      if (match) {
        const extension = match[1];
        return lastMessage.type === 'IMAGE'
          ? `📷 Изображение.${extension}`
          : `📎 Файл.${extension}`;
      }
      return lastMessage.type === 'IMAGE' ? '📷 Изображение' : '📎 Файл';
    }
    return lastMessage.type === 'IMAGE' ? '📷 Изображение' : '📎 Файл';
  }
  if (!lastMessage.content) {
    if (lastMessage.forwardedFrom?.originalContent) {
      return truncate(lastMessage.forwardedFrom.originalContent, PREVIEW_MAX_LENGTH);
    }
    if (lastMessage.replyTo?.content) {
      return truncate(lastMessage.replyTo.content, PREVIEW_MAX_LENGTH);
    }
    return 'Сообщение';
  }
  return truncate(lastMessage.content, PREVIEW_MAX_LENGTH);
};

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
  const msgTime = new Date(lastMessage.createdAt).getTime();
  if (Number.isNaN(msgTime)) return { isRead: false, readCount: 0, totalOthers: 0 };
  const participantIds = Array.isArray(chat?.participants)
    ? chat.participants.map((p) => Number(p?.id)).filter((n) => Number.isFinite(n))
    : [];
  const uniqueParticipantIds = Array.from(new Set(participantIds));
  const totalOthers = Math.max(0, (uniqueParticipantIds.length || 0) - 1);
  const otherReaders = Object.entries(chatReadMap)
    .filter(([rid]) => Number(rid) !== Number(user.id))
    .map(([, readAt]) => new Date(readAt).getTime())
    .filter((t) => !Number.isNaN(t));
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
  if (!chat?.participants || !user?.id) return false;
  if (chat.type !== 'DIRECT') return false;
  const other = chat.participants.find((p) => Number(p.id) !== Number(user.id));
  return other?.online || false;
};
