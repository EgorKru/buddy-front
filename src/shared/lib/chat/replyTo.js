/**
 * Снимок и подстановка replyTo для мгновенного отображения ответа в UI.
 */

export function messageToReplyToDto(message) {
  if (!message?.id) return null;
  return {
    id: message.id,
    senderId: message.senderId,
    senderUsername: message.senderUsername,
    senderDisplayName: message.senderDisplayName,
    content: message.content,
    type: message.type,
    createdAt: message.createdAt,
    edited: Boolean(message.edited),
    encryptionVersion: message.encryptionVersion ?? null,
  };
}

/**
 * Дополняет сообщение объектом replyTo из кэша сообщений чата.
 */
export function enrichMessageWithReply(message, messagesById = {}) {
  if (!message) return message;
  if (message.replyTo?.id) return message;

  const replyId = message.replyToMessageId ?? message.replyTo?.id;
  if (replyId == null) return message;

  const cached = messagesById[String(replyId)];
  if (!cached) return message;

  return {
    ...message,
    replyTo: messageToReplyToDto(cached),
  };
}
