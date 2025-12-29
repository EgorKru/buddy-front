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

/**
 * Хук для управления отправкой сообщений с поддержкой:
 * - Оптимистичных обновлений
 * - Повторных попыток
 * - Офлайн-режима
 * - Очереди сообщений
 * - Статусов сообщений
 */
export const useMessageSender = (chatId, onMessageSent) => {
  const { client, connected } = useStomp();
  const [sending, setSending] = useState(false);
  const retryTimeoutRef = useRef(null);
  const messageSentSubscriptionRef = useRef(null);
  const lastSentMessageRef = useRef(null); // Для связи с подтверждениями

  /**
   * Отправляет сообщение через WebSocket или REST API
   */
  const sendMessage = useCallback(async (content, type = 'TEXT') => {
    console.log('🚀 sendMessage вызван:', { content: content.substring(0, 50), type, sending });
    if (!content.trim() || sending) {
      console.log('⚠️ sendMessage: пропуск - пустое сообщение или уже отправляется');
      return null;
    }

    const messageContent = content.trim();
    
    // Создаем оптимистичное сообщение
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage = {
      id: tempId,
      tempId: tempId,
      content: messageContent,
      type,
      status: MESSAGE_STATUS.SENDING,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      senderId: getCurrentUser()?.id,
      senderUsername: getCurrentUser()?.username,
      senderDisplayName: getCurrentUser()?.displayName || getCurrentUser()?.username,
    };

    // Сохраняем chatId для связи с подтверждениями
    const messageWithChatId = {
      ...optimisticMessage,
      chatId: parseInt(chatId),
    };
    
    // Сохраняем в очередь
    const queuedMessage = saveMessageToQueue(messageWithChatId);
    if (!queuedMessage) {
      console.error('Не удалось сохранить сообщение в очередь');
      return null;
    }
    
    // Сохраняем ссылку на последнее отправленное сообщение для связи с подтверждением
    lastSentMessageRef.current = queuedMessage;

    // Вызываем callback для добавления в UI
    console.log('📤 Вызываем onMessageSent с оптимистичным сообщением:', optimisticMessage);
    if (onMessageSent) {
      onMessageSent(optimisticMessage, tempId);
      console.log('✅ onMessageSent вызван');
    } else {
      console.warn('⚠️ onMessageSent не определен!');
    }

    setSending(true);

    try {
      // Проверяем состояние WebSocket более тщательно
      const isWebSocketReady = client && 
                               client.connected && 
                               client.active && 
                               (connected || client.state === 1); // 1 = CONNECTED
      
      console.log('🔍 Проверка WebSocket перед отправкой:', {
        hasClient: !!client,
        connected,
        clientConnected: client?.connected,
        clientActive: client?.active,
        clientState: client?.state,
        isWebSocketReady
      });
      
      // Пробуем отправить через WebSocket
      if (isWebSocketReady) {
        try {
          const destination = '/app/chat.sendMessage';
          const messagePayload = {
            chatId: parseInt(chatId),
            content: messageContent,
            type,
          };
          
          console.log('📤 Отправка сообщения через WebSocket:', {
            destination,
            payload: messagePayload,
            clientState: {
              connected: client.connected,
              active: client.active,
              state: client.state
            }
          });
          
          client.publish({
            destination,
            body: JSON.stringify(messagePayload),
          });
          
          console.log('✅ Сообщение отправлено через WebSocket, ждем подтверждения');
          
          // WebSocket отправка асинхронная, статус обновится при получении ответа
          // Не обновляем статус здесь, ждем подтверждения через подписку
          setSending(false);
          return optimisticMessage;
        } catch (wsError) {
          console.error('❌ Ошибка отправки через WebSocket:', wsError);
          // Продолжаем к fallback через REST API
        }
      }
      
      // Fallback: отправляем через REST API
      console.log('⚠️ WebSocket не готов, отправляем через REST API:', {
        hasClient: !!client,
        connected,
        clientConnected: client?.connected,
        clientActive: client?.active,
        clientState: client?.state
      });
      
      const serverMessage = await chatAPI.sendMessage(chatId, messageContent, type);
      
      // Обновляем статус в очереди
      updateMessageStatus(queuedMessage.tempId, MESSAGE_STATUS.SENT, serverMessage);
      removeMessageFromQueue(queuedMessage.tempId);
      
      // Вызываем callback с реальным сообщением
      if (onMessageSent) {
        onMessageSent(serverMessage, queuedMessage.tempId);
      }
      
      return serverMessage;
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      
      // Обновляем статус на FAILED
      updateMessageStatus(queuedMessage.tempId, MESSAGE_STATUS.FAILED);
      
      // Планируем повторную попытку через REST API
      scheduleRetry(queuedMessage, chatId, onMessageSent);
      
      // Вызываем callback для обновления UI
      if (onMessageSent) {
        onMessageSent({
          ...optimisticMessage,
          status: MESSAGE_STATUS.FAILED,
        }, queuedMessage.tempId);
      }
      
      return null;
    } finally {
      setSending(false);
    }
  }, [chatId, client, connected, sending, onMessageSent]);

  /**
   * Планирует повторную попытку отправки сообщения
   */
  const scheduleRetry = useCallback((message, messageChatId, onMessageSentCallback) => {
    const targetChatId = messageChatId || chatId;
    const retryCount = message.retryCount || 0;
    const maxRetries = 3;
    
    if (retryCount >= maxRetries) {
      console.warn('Достигнуто максимальное количество попыток для сообщения:', message.tempId);
      return;
    }

    const delays = [2000, 5000, 10000]; // Задержки между попытками
    const delay = delays[retryCount] || 10000;

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    retryTimeoutRef.current = setTimeout(async () => {
      try {
        updateMessageStatus(message.tempId, MESSAGE_STATUS.SENDING);
        
        if (onMessageSentCallback) {
          onMessageSentCallback({
            ...message,
            status: MESSAGE_STATUS.SENDING,
          }, message.tempId);
        }

        const serverMessage = await chatAPI.sendMessage(targetChatId, message.content, message.type);
        
        updateMessageStatus(message.tempId, MESSAGE_STATUS.SENT, serverMessage);
        removeMessageFromQueue(message.tempId);
        
        if (onMessageSentCallback) {
          onMessageSentCallback(serverMessage, message.tempId);
        }
      } catch (error) {
        console.error('Ошибка повторной отправки:', error);
        updateMessageStatus(message.tempId, MESSAGE_STATUS.FAILED);
        
        // Планируем следующую попытку
        scheduleRetry({
          ...message,
          retryCount: retryCount + 1,
        }, targetChatId, onMessageSentCallback);
      }
    }, delay);
  }, [chatId]);

  /**
   * Синхронизирует очередь сообщений с сервером
   */
  const syncQueue = useCallback(async () => {
    if (!chatId) return;

    const sendMessageFn = async (message) => {
      return await chatAPI.sendMessage(chatId, message.content, message.type);
    };

    const results = await syncMessageQueue(sendMessageFn);
    
    // Обновляем UI для каждого синхронизированного сообщения
    results.forEach(result => {
      if (result.success && onMessageSent) {
        onMessageSent(result.message);
      }
    });

    return results;
  }, [chatId, onMessageSent]);

  /**
   * Обрабатывает получение сообщения от сервера (через WebSocket)
   * Заменяет оптимистичное сообщение на реальное
   */
  const handleServerMessage = useCallback((serverMessage, tempId) => {
    if (tempId) {
      updateMessageStatus(tempId, MESSAGE_STATUS.SENT, serverMessage);
      removeMessageFromQueue(tempId);
    }
    
    if (onMessageSent) {
      onMessageSent(serverMessage, tempId);
    }
  }, [onMessageSent]);

  /**
   * Подписывается на подтверждения отправки сообщений от бэкенда
   */
  useEffect(() => {
    // Ждем подключения WebSocket
    if (!client || !connected) {
      console.log('⚠️ useMessageSender: Ожидаем подключения WebSocket:', {
        hasClient: !!client,
        connected,
        clientConnected: client?.connected,
        clientActive: client?.active
      });
      return;
    }
    
    // Проверяем, что клиент действительно подключен и активен
    if (!client.connected || !client.active) {
      console.log('⚠️ useMessageSender: Клиент не подключен или не активен, ждем...');
      // Повторяем попытку через небольшую задержку
      const timeout = setTimeout(() => {
        if (client.connected && client.active) {
          // Перезапустим эффект
          console.log('✅ useMessageSender: Клиент подключен, переподписываемся');
        }
      }, 500);
      return () => clearTimeout(timeout);
    }

    console.log('📡 useMessageSender: Подписываемся на /user/queue/message-sent');
    
    // Отписываемся от старой подписки, если есть
    if (messageSentSubscriptionRef.current) {
      try {
        messageSentSubscriptionRef.current.unsubscribe();
        console.log('🔌 Отписались от старой подписки на подтверждения');
      } catch (error) {
        console.error('Ошибка отписки от старой подписки на подтверждения:', error);
      }
      messageSentSubscriptionRef.current = null;
    }
    
    try {
      const subscription = client.subscribe('/user/queue/message-sent', (message) => {
        try {
          console.log('📬 Получено сообщение в /user/queue/message-sent:');
          console.log('  - Destination:', message.headers?.destination || 'N/A');
          console.log('  - Subscription:', message.headers?.subscription || 'N/A');
          console.log('  - Message ID:', message.headers?.['message-id'] || 'N/A');
          console.log('  - Raw body:', message.body);
          const confirmation = JSON.parse(message.body);
          
          console.log('📬 Получено подтверждение отправки:', confirmation);

          if (confirmation.status === 'sent') {
            // Сообщение успешно отправлено
            // Ищем сообщение в очереди по chatId и статусу SENDING
            // Приоритет: последнее отправленное сообщение, затем поиск в очереди
            let queuedMessage = null;
            
            // Сначала проверяем последнее отправленное сообщение
            if (lastSentMessageRef.current && 
                lastSentMessageRef.current.chatId === confirmation.chatId &&
                lastSentMessageRef.current.status === MESSAGE_STATUS.SENDING) {
              queuedMessage = lastSentMessageRef.current;
            } else {
              // Ищем в очереди
              const queue = getMessageQueue();
              // Берем последнее сообщение с нужным chatId и статусом SENDING
              const matchingMessages = queue.filter(msg => 
                msg.chatId === confirmation.chatId && 
                msg.status === MESSAGE_STATUS.SENDING
              );
              if (matchingMessages.length > 0) {
                // Берем самое последнее (самое свежее)
                queuedMessage = matchingMessages.sort((a, b) => 
                  new Date(b.createdAt) - new Date(a.createdAt)
                )[0];
              }
            }

            if (queuedMessage) {
              // Обновляем статус в очереди
              updateMessageStatus(queuedMessage.tempId, MESSAGE_STATUS.SENT);
              
              // Удаляем из очереди после небольшой задержки (чтобы UI успел обновиться)
              setTimeout(() => {
                removeMessageFromQueue(queuedMessage.tempId);
                if (lastSentMessageRef.current?.tempId === queuedMessage.tempId) {
                  lastSentMessageRef.current = null;
                }
              }, 1000);

              // Обновляем UI через callback - заменяем tempId на реальный messageId
              if (onMessageSent) {
                console.log('📬 Обновляем UI: заменяем оптимистичное сообщение на подтвержденное:', {
                  tempId: queuedMessage.tempId,
                  messageId: confirmation.messageId,
                  chatId: confirmation.chatId
                });
                onMessageSent({
                  id: confirmation.messageId,
                  status: MESSAGE_STATUS.SENT,
                  chatId: confirmation.chatId,
                }, queuedMessage.tempId);
              }
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Не найдено сообщение для подтверждения:', confirmation);
              }
            }
          } else if (confirmation.status === 'failed') {
            // Ошибка отправки
            let queuedMessage = null;
            
            // Сначала проверяем последнее отправленное сообщение
            if (lastSentMessageRef.current && 
                lastSentMessageRef.current.chatId === confirmation.chatId &&
                lastSentMessageRef.current.status === MESSAGE_STATUS.SENDING) {
              queuedMessage = lastSentMessageRef.current;
            } else {
              // Ищем в очереди
              const queue = getMessageQueue();
              const matchingMessages = queue.filter(msg => 
                msg.chatId === confirmation.chatId && 
                msg.status === MESSAGE_STATUS.SENDING
              );
              if (matchingMessages.length > 0) {
                queuedMessage = matchingMessages.sort((a, b) => 
                  new Date(b.createdAt) - new Date(a.createdAt)
                )[0];
              }
            }

            if (queuedMessage) {
              // Обновляем статус на FAILED
              updateMessageStatus(queuedMessage.tempId, MESSAGE_STATUS.FAILED);
              
              // Обновляем UI
              if (onMessageSent) {
                onMessageSent({
                  ...queuedMessage,
                  status: MESSAGE_STATUS.FAILED,
                }, queuedMessage.tempId);
              }

              // Показываем ошибку пользователю
              if (confirmation.errorMessage) {
                console.error('Ошибка отправки сообщения:', confirmation.errorMessage);
                if (typeof window !== 'undefined') {
                  alert(`Не удалось отправить сообщение: ${confirmation.errorMessage}`);
                }
              }

              // Планируем повторную попытку через REST API
              scheduleRetry(queuedMessage, confirmation.chatId, onMessageSent);
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Не найдено сообщение для обработки ошибки:', confirmation);
              }
            }
          }
        } catch (error) {
          console.error('Ошибка обработки подтверждения отправки:', error);
        }
      });

            messageSentSubscriptionRef.current = subscription;

            console.log('✅ useMessageSender: Успешно подписались на подтверждения отправки сообщений, Subscription ID:', subscription.id);

      return () => {
        if (messageSentSubscriptionRef.current) {
          messageSentSubscriptionRef.current.unsubscribe();
          messageSentSubscriptionRef.current = null;
        }
      };
    } catch (error) {
      console.error('Ошибка подписки на подтверждения отправки:', error);
    }
  }, [client, connected, chatId, onMessageSent]);

  return {
    sendMessage,
    sending,
    syncQueue,
    handleServerMessage,
  };
};

