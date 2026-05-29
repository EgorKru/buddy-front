import { useState, useCallback, useRef, useEffect } from 'react';
import { useStomp } from '@/context/socket';
import { chatAPI, getCurrentUser } from '@/utils/api';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import {
  saveMessageToQueue,
  updateMessageStatus,
  removeMessageFromQueue,
  syncMessageQueue,
  getMessageQueue,
  MESSAGE_STATUS,
} from '@/utils/messageQueue';
import { messageToReplyToDto } from '@/shared/lib/chat/replyTo';

const STOMP_CONNECTED_STATE = 1;
const RETRY_DELAYS = [2000, 5000, 10000];
const MAX_RETRIES = 3;
const DEDUP_CLEANUP_INTERVAL = 5 * 60 * 1000;
const DEDUP_CLEANUP_THRESHOLD = 100;
const QUEUE_REMOVAL_DELAY = 1000;

const createOptimisticMessage = (
  content,
  type,
  chatId,
  user,
  fileUrl = null,
  fileName = null,
  fileSize = null,
  mimeType = null,
  e2ee = null,
  replyToMessageId = null,
  replyToMessage = null
) => {
  const tempId = `temp-${Date.now()}-${Math.random()}`;
  let messageContent;
  if (type === 'VOICE') {
    messageContent = '🎤 Голосовое сообщение';
  } else if (type === 'IMAGE' || type === 'FILE') {
    messageContent =
      content && content.trim() ? content.trim() : type === 'IMAGE' ? '📷 Фото' : '📎 Файл';
  } else if (e2ee?.wireContent != null) {
    messageContent = e2ee.wireContent;
  } else {
    messageContent = content.trim();
  }
  const message = {
    id: tempId,
    tempId,
    chatId: parseInt(chatId),
    content: messageContent,
    type,
    fileUrl,
    fileName,
    fileSize,
    mimeType,
    status: MESSAGE_STATUS.SENDING,
    createdAt: new Date().toISOString(),
    isOptimistic: true,
    senderId: user?.id,
    senderUsername: user?.username,
    senderDisplayName: user?.displayName || user?.username,
    retryCount: 0,
  };
  if (e2ee?.encryptionVersion != null) {
    message.encryptionVersion = e2ee.encryptionVersion;
  }
  if (replyToMessageId != null) {
    message.replyToMessageId = replyToMessageId;
  }
  if (replyToMessage) {
    message.replyTo = messageToReplyToDto(replyToMessage);
  }
  return message;
};

const findQueuedMessageForConfirmation = (lastSent, queue, chatId) => {
  if (lastSent && lastSent.chatId === chatId && lastSent.status === MESSAGE_STATUS.SENDING) {
    return lastSent;
  }
  const matching = queue.filter(
    (msg) => msg.chatId === chatId && msg.status === MESSAGE_STATUS.SENDING
  );
  if (matching.length > 0) {
    return matching.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }
  return null;
};

export const useMessageSender = (chatId, onMessageSent, options = {}) => {
  const directPeerUserId = options?.directPeerUserId ?? null;
  const e2eeDirectTextBlockedReason = options?.e2eeDirectTextBlockedReason ?? null;
  const onBeforeSend = options?.onBeforeSend ?? null;
  const { client, connected } = useStomp();
  const [sending, setSending] = useState(false);
  const retryTimeoutRef = useRef(null);
  const messageSentSubscriptionRef = useRef(null);
  const lastSentMessageRef = useRef(null);
  const processedMessagesRef = useRef(new Set());

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      if (processedMessagesRef.current.size > DEDUP_CLEANUP_THRESHOLD) {
        processedMessagesRef.current.clear();
      }
    }, DEDUP_CLEANUP_INTERVAL);
    return () => clearInterval(cleanupInterval);
  }, []);

  const scheduleRetry = useCallback(
    (message, messageChatId, onMessageSentCallback) => {
      const targetChatId = messageChatId || chatId;
      const retryCount = message.retryCount || 0;

      if (retryCount >= MAX_RETRIES) return;

      const delay = RETRY_DELAYS[retryCount] || 10000;

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      retryTimeoutRef.current = setTimeout(async () => {
        try {
          updateMessageStatus(message.tempId, MESSAGE_STATUS.SENDING);

          if (message.type === 'IMAGE' || message.type === 'FILE' || message.type === 'VOICE') {
            updateMessageStatus(message.tempId, MESSAGE_STATUS.FAILED);
            if (onMessageSentCallback) {
              onMessageSentCallback({ status: 'failed', message: message }, message.tempId);
            }
            return;
          }

          const serverMessage = await chatAPI.sendMessage(
            targetChatId,
            message.content,
            message.type,
            message.fileUrl,
            message.replyToMessageId ?? null,
            message.encryptionVersion ?? null
          );

          updateMessageStatus(message.tempId, MESSAGE_STATUS.SENT, serverMessage);
          removeMessageFromQueue(message.tempId);

          if (onMessageSentCallback) {
            onMessageSentCallback({ status: 'sent', message: serverMessage }, message.tempId);
          }
        } catch (error) {
          updateMessageStatus(message.tempId, MESSAGE_STATUS.FAILED);
          if (onMessageSentCallback) {
            onMessageSentCallback({ status: 'failed', message: message }, message.tempId);
          }
          scheduleRetry(
            {
              ...message,
              retryCount: retryCount + 1,
            },
            targetChatId,
            onMessageSentCallback
          );
        }
      }, delay);
    },
    [chatId]
  );

  const sendMessage = useCallback(
    async (
      content,
      type = 'TEXT',
      fileUrl = null,
      voiceData = null,
      voiceMimeType = null,
      duration = null,
      replyToMessageId = null,
      fileName = null,
      fileSize = null,
      mimeType = null,
      replyToMessage = null
    ) => {
      if (type === 'VOICE' && !fileUrl && !voiceData) return null;
      if (type === 'IMAGE' && !fileUrl) return null;
      if (type === 'FILE' && !fileUrl) return null;
      if (type !== 'VOICE' && type !== 'IMAGE' && type !== 'FILE' && !content.trim()) return null;
      if (sending) return null;

      let encryptionVersionToSend = null;
      let textWireContent = null;
      if (type === 'TEXT') {
        if (e2eeDirectTextBlockedReason === 'no_peer') {
          if (typeof window !== 'undefined') {
            alert(
              'Не удалось отправить сообщение. Обновите страницу или дождитесь загрузки списка чатов.'
            );
          }
          return null;
        }
        textWireContent = content.trim();
        if (directPeerUserId) {
          try {
            const e2ee = await import('@/shared/lib/e2ee/directTextE2ee');
            if (e2ee.isE2eeEnabled()) {
              const enc = await e2ee.encryptDirectText(directPeerUserId, textWireContent);
              if (enc) {
                encryptionVersionToSend = enc.encryptionVersion;
                textWireContent = enc.content;
              } else if (typeof window !== 'undefined') {
                alert(
                  'Не удалось отправить сообщение. Выйдите и войдите снова или обновите страницу.'
                );
                return null;
              }
            }
          } catch (e) {
            if (typeof window !== 'undefined') {
              alert(`Не удалось отправить сообщение: ${e?.message || e}`);
            }
            return null;
          }
        }
      }

      const messageContent =
        type === 'VOICE'
          ? '🎤 Голосовое сообщение'
          : type === 'IMAGE'
            ? content?.trim() || '📷 Фото'
            : type === 'FILE'
              ? content?.trim() || '📎 Файл'
              : (textWireContent ?? content.trim());

      const e2eeWire =
        type === 'TEXT' && encryptionVersionToSend != null
          ? { wireContent: textWireContent, encryptionVersion: encryptionVersionToSend }
          : null;

      const user = getCurrentUser();
      const optimisticMessage = createOptimisticMessage(
        content,
        type,
        chatId,
        user,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        e2eeWire,
        replyToMessageId,
        replyToMessage
      );

      if (!saveMessageToQueue(optimisticMessage)) return null;

      lastSentMessageRef.current = optimisticMessage;
      onBeforeSend?.(optimisticMessage);
      setSending(true);

      try {
        const isWebSocketReady = Boolean(client && connected);

        // TEXT через REST: гарантированное сохранение и broadcast на /topic/chat/{id}
        if (isWebSocketReady && type !== 'TEXT') {
          try {
            const payload = {
              chatId: parseInt(chatId),
              type,
            };

            if (type === 'VOICE') {
              if (fileUrl) {
                payload.fileUrl = fileUrl;

                if (duration !== null && duration !== undefined) {
                  payload.duration = duration;
                }
              } else if (voiceData) {
                payload.voiceData = voiceData;
                payload.voiceMimeType = voiceMimeType || 'audio/webm';

                if (duration !== null && duration !== undefined) {
                  payload.duration = duration;
                }
              } else {
                throw new Error('Neither fileUrl nor voiceData provided for VOICE message');
              }
            } else if (type === 'IMAGE' || type === 'FILE') {
              if (!fileUrl) {
                throw new Error(`fileUrl is required for ${type} message`);
              }
              payload.fileUrl = fileUrl;
              if (fileName) {
                payload.fileName = fileName;
              }
              if (fileSize !== null && fileSize !== undefined) {
                payload.fileSize = fileSize;
              }
              if (mimeType) {
                payload.mimeType = mimeType;
              }
              if (content && content.trim()) {
                payload.content = content.trim();
              }
            } else {
              payload.content =
                type === 'TEXT' ? (textWireContent ?? content.trim()) : messageContent;
              if (encryptionVersionToSend != null) {
                payload.encryptionVersion = encryptionVersionToSend;
              }
            }

            if (replyToMessageId) {
              payload.replyToMessageId = replyToMessageId;
            }

            if ((type === 'IMAGE' || type === 'FILE') && !payload.fileUrl) {
              throw new Error(`fileUrl is missing in payload for ${type} message`);
            }

            const serializedPayload = JSON.stringify(payload);
            client.publish({
              destination: '/app/chat.sendMessage',
              body: serializedPayload,
            });
            setSending(false);
            return {
              success: true,
              tempId: optimisticMessage.tempId,
              optimisticMessage,
              serverMessage: null,
            };
          } catch (wsError) {
            if (type === 'VOICE' || type === 'IMAGE' || type === 'FILE') {
              setSending(false);
              throw new Error(
                `Failed to send ${type} message via WebSocket. Please ensure WebSocket is connected.`
              );
            }
          }
        }

        if (type === 'VOICE' || type === 'IMAGE' || type === 'FILE') {
          setSending(false);
          throw new Error(
            `${type} messages can only be sent via WebSocket. WebSocket is not connected.`
          );
        }

        const serverMessage = await chatAPI.sendMessage(
          chatId,
          type === 'TEXT' ? (textWireContent ?? content.trim()) : messageContent,
          type,
          fileUrl,
          replyToMessageId,
          encryptionVersionToSend
        );

        updateMessageStatus(optimisticMessage.tempId, MESSAGE_STATUS.SENT, serverMessage);
        removeMessageFromQueue(optimisticMessage.tempId);

        if (onMessageSent) {
          onMessageSent({ status: 'sent', message: serverMessage }, optimisticMessage.tempId);
        }

        setSending(false);
        return {
          success: true,
          tempId: optimisticMessage.tempId,
          optimisticMessage,
          serverMessage,
        };
      } catch (error) {
        updateMessageStatus(optimisticMessage.tempId, MESSAGE_STATUS.FAILED);
        if (onMessageSent) {
          onMessageSent({ status: 'failed', message: optimisticMessage }, optimisticMessage.tempId);
        }
        scheduleRetry(optimisticMessage, chatId, onMessageSent);
        setSending(false);
        return {
          success: false,
          tempId: optimisticMessage.tempId,
          optimisticMessage,
          serverMessage: null,
        };
      } finally {
        setSending(false);
      }
    },
    [
      chatId,
      client,
      connected,
      sending,
      onMessageSent,
      scheduleRetry,
      directPeerUserId,
      e2eeDirectTextBlockedReason,
      onBeforeSend,
    ]
  );

  const syncQueue = useCallback(async () => {
    if (!chatId || !client || !connected) return;

    const sendMessageFn = async (message) => {
      if (message.status === MESSAGE_STATUS.SENT) return null;

      const messageChatId = message.chatId || chatId;

      if (message.type === 'VOICE' || message.type === 'IMAGE' || message.type === 'FILE') {
        if (!message.fileUrl) {
          return null;
        }
        if (client.connected && client.active) {
          try {
            const payload = {
              chatId: parseInt(messageChatId),
              type: message.type,
              fileUrl: message.fileUrl,
            };
            if (message.type === 'VOICE' && message.duration) {
              payload.duration = message.duration;
            }
            if (message.content && message.content.trim()) {
              payload.content = message.content.trim();
            }
            client.publish({
              destination: '/app/chat.sendMessage',
              body: JSON.stringify(payload),
            });
            return { success: true };
          } catch (error) {}
        }
        return null;
      }

      if (client.connected && client.active) {
        try {
          const textPayload = {
            chatId: parseInt(messageChatId),
            content: message.content,
            type: message.type,
          };
          if (message.encryptionVersion != null && message.encryptionVersion > 0) {
            textPayload.encryptionVersion = message.encryptionVersion;
          }
          if (message.replyToMessageId != null) {
            textPayload.replyToMessageId = message.replyToMessageId;
          }
          client.publish({
            destination: '/app/chat.sendMessage',
            body: JSON.stringify(textPayload),
          });
          return { success: true };
        } catch (error) {}
      }

      if (message.type === 'IMAGE' || message.type === 'FILE' || message.type === 'VOICE') {
        return null;
      }

      return await chatAPI.sendMessage(
        messageChatId,
        message.content,
        message.type,
        message.fileUrl,
        message.replyToMessageId ?? null,
        message.encryptionVersion ?? null
      );
    };

    return await syncMessageQueue(sendMessageFn);
  }, [chatId, client, connected]);

  const handleServerMessage = useCallback(
    (serverMessage, tempId) => {
      if (tempId) {
        updateMessageStatus(tempId, MESSAGE_STATUS.SENT, serverMessage);
        removeMessageFromQueue(tempId);
      }

      if (onMessageSent) {
        onMessageSent({ status: 'sent', message: serverMessage }, tempId);
      }
    },
    [onMessageSent]
  );

  useEffect(() => {
    if (!client || !connected || !client.connected || !client.active) return;

    if (messageSentSubscriptionRef.current) {
      safeUnsubscribe(messageSentSubscriptionRef.current);
      messageSentSubscriptionRef.current = null;
    }

    try {
      const subscription = client.subscribe('/user/queue/message-sent', (message) => {
        try {
          const confirmation = safeJsonParse(message.body);
          if (!confirmation) return;

          if (confirmation.status === 'sent') {
            const confirmationKey = confirmation.messageId
              ? `confirm:${confirmation.messageId}`
              : `confirm:${confirmation.chatId}:${Date.now()}`;

            if (processedMessagesRef.current.has(confirmationKey)) return;
            if (
              confirmation.messageId &&
              processedMessagesRef.current.has(`id:${confirmation.messageId}`)
            )
              return;

            const queuedMessage = findQueuedMessageForConfirmation(
              lastSentMessageRef.current,
              getMessageQueue(),
              confirmation.chatId
            );

            if (queuedMessage) {
              processedMessagesRef.current.add(confirmationKey);
              if (confirmation.messageId) {
                processedMessagesRef.current.add(`id:${confirmation.messageId}`);
              }

              updateMessageStatus(queuedMessage.tempId, MESSAGE_STATUS.SENT);

              setTimeout(() => {
                removeMessageFromQueue(queuedMessage.tempId);
                if (lastSentMessageRef.current?.tempId === queuedMessage.tempId) {
                  lastSentMessageRef.current = null;
                }
              }, QUEUE_REMOVAL_DELAY);

              if (onMessageSent && queuedMessage.tempId) {
                if (confirmation.message) {
                  onMessageSent(confirmation, queuedMessage.tempId);
                } else if (confirmation.messageId) {
                  const messageDto = {
                    id: confirmation.messageId,
                    chatId: confirmation.chatId,
                    content: queuedMessage.content,
                    type: queuedMessage.type,
                    senderId: queuedMessage.senderId,
                    senderUsername: queuedMessage.senderUsername,
                    senderDisplayName: queuedMessage.senderDisplayName,
                    createdAt: queuedMessage.createdAt,
                    encryptionVersion: queuedMessage.encryptionVersion,
                  };
                  onMessageSent({ ...confirmation, message: messageDto }, queuedMessage.tempId);
                }
              }
            }
          } else if (confirmation.status === 'failed') {
            const queuedMessage = findQueuedMessageForConfirmation(
              lastSentMessageRef.current,
              getMessageQueue(),
              confirmation.chatId
            );

            if (queuedMessage) {
              updateMessageStatus(queuedMessage.tempId, MESSAGE_STATUS.FAILED);

              if (onMessageSent && queuedMessage.tempId) {
                const messageDto = {
                  ...queuedMessage,
                  id: confirmation.messageId || queuedMessage.id,
                };
                onMessageSent({ ...confirmation, message: messageDto }, queuedMessage.tempId);
              }

              if (confirmation.errorMessage && typeof window !== 'undefined') {
                alert(`Не удалось отправить сообщение: ${confirmation.errorMessage}`);
              }

              scheduleRetry(queuedMessage, confirmation.chatId, onMessageSent);
            }
          }
        } catch (error) {}
      });

      messageSentSubscriptionRef.current = subscription;

      return () => {
        if (messageSentSubscriptionRef.current) {
          safeUnsubscribe(messageSentSubscriptionRef.current);
          messageSentSubscriptionRef.current = null;
        }
      };
    } catch (error) {}
  }, [client, connected, chatId, onMessageSent, scheduleRetry]);

  return {
    sendMessage,
    sending,
    syncQueue,
    handleServerMessage,
  };
};
