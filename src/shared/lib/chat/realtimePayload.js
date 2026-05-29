/**
 * Разбор STOMP payload и план обработки своих/чужих сообщений (без React).
 */

/**
 * @param {object|null|undefined} data — тело STOMP / chat update
 * @returns {object|null}
 */
export function extractChatMessageFromStompPayload(data) {
  if (!data) return null;
  if (data.eventType === 'MESSAGE_NEW' && data.message) return data.message;
  if (data.message?.id != null && data.message?.chatId != null) return data.message;
  if (data.id != null && data.chatId != null) return data;
  return null;
}

/**
 * @param {object|null|undefined} notification
 * @returns {object|null}
 */
export function extractNotificationMessage(notification) {
  if (!notification) return null;
  if (
    notification.id != null &&
    notification.chatId != null &&
    (notification.type != null || notification.content != null)
  ) {
    return notification;
  }
  return notification.message ?? notification.payload?.message ?? null;
}

/**
 * @typedef {'none'|'replace'|'upsert'} OwnMessageAction
 */

/**
 * Решает, как применить своё сообщение из STOMP: заменить optimistic или upsert с сервера.
 *
 * @param {{
 *   dto: object,
 *   chatId: string|number,
 *   messageIdsByChatId?: Record<string, string[]>,
 *   messagesById?: Record<string, object>,
 *   currentUserId?: string|number,
 *   now?: number,
 *   maxOptimisticAgeMs?: number,
 * }} params
 * @returns {{ action: OwnMessageAction, tempId?: string, dto?: object }}
 */
export function planOwnIncomingStompMessage({
  dto,
  chatId,
  messageIdsByChatId = {},
  messagesById = {},
  currentUserId,
  now = Date.now(),
  maxOptimisticAgeMs = 30000,
}) {
  if (!dto?.id || !dto?.chatId) return { action: 'none' };
  if (Number(dto.chatId) !== Number(chatId)) return { action: 'none' };
  if (!currentUserId || Number(dto.senderId) !== Number(currentUserId)) {
    return { action: 'none' };
  }

  const cid = String(chatId);
  const messageIds = Array.isArray(messageIdsByChatId[cid]) ? messageIdsByChatId[cid] : [];

  let optimisticMessages = messageIds
    .map((id) => messagesById[String(id)])
    .filter((msg) => msg && msg.isOptimistic && msg.tempId && msg.type === dto.type);

  if (dto.type === 'FILE' || dto.type === 'IMAGE') {
    if (dto.fileUrl) {
      optimisticMessages = optimisticMessages.filter((msg) => msg.fileUrl === dto.fileUrl);
    }
  }

  optimisticMessages.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (optimisticMessages.length > 0) {
    const latestOptimistic = optimisticMessages[0];
    const optimisticTime = new Date(latestOptimistic.createdAt || now).getTime();
    const timeDiff = now - optimisticTime;
    if (timeDiff < maxOptimisticAgeMs) {
      return { action: 'replace', tempId: latestOptimistic.tempId, dto };
    }
  }

  return { action: 'upsert', dto };
}
