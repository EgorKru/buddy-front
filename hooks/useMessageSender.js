import { useState, useCallback, useRef, useEffect } from 'react';
import { useStomp } from '@/context/socket';
import { chatAPI, getCurrentUser } from '@/utils/api';
import {
  saveMessageToQueue,
  updateMessageStatus,
  removeMessageFromQueue,
  syncMessageQueue,
  getMessageQueue,
  MESSAGE_STATUS,
} from '@/utils/messageQueue';

const STOMP_CONNECTED_STATE = 1;
const RETRY_DELAYS = [2000, 5000, 10000];
const MAX_RETRIES = 3;
const DEDUP_CLEANUP_INTERVAL = 5 * 60 * 1000;
const DEDUP_CLEANUP_THRESHOLD = 100;
const QUEUE_REMOVAL_DELAY = 1000;

const createOptimisticMessage = (content, type, chatId, user) => {
  const tempId = `temp-${Date.now()}-${Math.random()}`;
  return {
    id: tempId,
    tempId,
    chatId: parseInt(chatId),
    content: content.trim(),
    type,
    status: MESSAGE_STATUS.SENDING,
    createdAt: new Date().toISOString(),
    isOptimistic: true,
    senderId: user?.id,
    senderUsername: user?.username,
    senderDisplayName: user?.displayName || user?.username,
    retryCount: 0,
  };
};

const findQueuedMessageForConfirmation = (lastSent, queue, chatId) => {
  if (lastSent && lastSent.chatId === chatId && lastSent.status === MESSAGE_STATUS.SENDING) {
    return lastSent;
  }
  const matching = queue.filter(msg => msg.chatId === chatId && msg.status === MESSAGE_STATUS.SENDING);
  if (matching.length > 0) {
    return matching.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }
  return null;
};

export const useMessageSender = (chatId, onMessageSent) => {
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

  const scheduleRetry = useCallback((message, messageChatId, onMessageSentCallback) => {
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

        const serverMessage = await chatAPI.sendMessage(targetChatId, message.content, message.type);

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
        scheduleRetry({
          ...message,
          retryCount: retryCount + 1,
        }, targetChatId, onMessageSentCallback);
      }
    }, delay);
  }, [chatId]);

  const sendMessage = useCallback(async (content, type = 'TEXT') => {
    if (!content.trim() || sending) return null;

    const messageContent = content.trim();
    const user = getCurrentUser();
    const optimisticMessage = createOptimisticMessage(messageContent, type, chatId, user);

    if (!saveMessageToQueue(optimisticMessage)) return null;

    lastSentMessageRef.current = optimisticMessage;
    setSending(true);

    try {
      const isWebSocketReady = client &&
        client.connected &&
        client.active &&
        (connected || client.state === STOMP_CONNECTED_STATE);

      if (isWebSocketReady) {
        try {
          client.publish({
            destination: '/app/chat.sendMessage',
            body: JSON.stringify({
              chatId: parseInt(chatId),
              content: messageContent,
              type,
            }),
          });
          setSending(false);
          return { success: true, tempId: optimisticMessage.tempId, optimisticMessage };
        } catch (wsError) {}
      }

      const serverMessage = await chatAPI.sendMessage(chatId, messageContent, type);

      updateMessageStatus(optimisticMessage.tempId, MESSAGE_STATUS.SENT, serverMessage);
      removeMessageFromQueue(optimisticMessage.tempId);

      if (onMessageSent) {
        onMessageSent({ status: 'sent', message: serverMessage }, optimisticMessage.tempId);
      }

      setSending(false);
      return { success: true, tempId: optimisticMessage.tempId, optimisticMessage };
    } catch (error) {
      updateMessageStatus(optimisticMessage.tempId, MESSAGE_STATUS.FAILED);
      if (onMessageSent) {
        onMessageSent({ status: 'failed', message: optimisticMessage }, optimisticMessage.tempId);
      }
      scheduleRetry(optimisticMessage, chatId, onMessageSent);
      setSending(false);
      return null;
    } finally {
      setSending(false);
    }
  }, [chatId, client, connected, sending, onMessageSent, scheduleRetry]);

  const syncQueue = useCallback(async () => {
    if (!chatId || !client || !connected) return;

    const sendMessageFn = async (message) => {
      if (message.status === MESSAGE_STATUS.SENT) return null;

      if (client.connected && client.active) {
        try {
          client.publish({
            destination: '/app/chat.sendMessage',
            body: JSON.stringify({
              chatId: parseInt(chatId),
              content: message.content,
              type: message.type,
            }),
          });
          return { success: true };
        } catch (error) {}
      }

      return await chatAPI.sendMessage(chatId, message.content, message.type);
    };

    return await syncMessageQueue(sendMessageFn);
  }, [chatId, client, connected]);

  const handleServerMessage = useCallback((serverMessage, tempId) => {
    if (tempId) {
      updateMessageStatus(tempId, MESSAGE_STATUS.SENT, serverMessage);
      removeMessageFromQueue(tempId);
    }

    if (onMessageSent) {
      onMessageSent({ status: 'sent', message: serverMessage }, tempId);
    }
  }, [onMessageSent]);

  useEffect(() => {
    if (!client || !connected || !client.connected || !client.active) return;

    if (messageSentSubscriptionRef.current) {
      try {
        messageSentSubscriptionRef.current.unsubscribe();
      } catch (error) {}
      messageSentSubscriptionRef.current = null;
    }

    try {
      const subscription = client.subscribe('/user/queue/message-sent', (message) => {
        try {
          const confirmation = JSON.parse(message.body);

          if (confirmation.status === 'sent') {
            const confirmationKey = confirmation.messageId
              ? `confirm:${confirmation.messageId}`
              : `confirm:${confirmation.chatId}:${Date.now()}`;

            if (processedMessagesRef.current.has(confirmationKey)) return;
            if (confirmation.messageId && processedMessagesRef.current.has(`id:${confirmation.messageId}`)) return;

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
                if (confirmation.status === 'sent' && confirmation.message) {
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
                  };
                  onMessageSent({
                    ...confirmation,
                    message: messageDto,
                  }, queuedMessage.tempId);
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
                onMessageSent({
                  ...confirmation,
                  message: messageDto,
                }, queuedMessage.tempId);
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
          messageSentSubscriptionRef.current.unsubscribe();
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
