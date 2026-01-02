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
  const userMessagesSubscriptionRef = useRef(null);
  const lastSentMessageRef = useRef(null); // Для связи с подтверждениями
  const processedMessagesRef = useRef(new Set()); // Для дедупликации сообщений
  
  // Очистка старых записей дедупликации (каждые 5 минут)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      if (processedMessagesRef.current.size > 100) {
        processedMessagesRef.current.clear();
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(cleanupInterval);
  }, []);

  /**
   * Отправляет сообщение через WebSocket или REST API
   */
  const sendMessage = useCallback(async (content, type = 'TEXT') => {
    if (!content.trim() || sending) {
      return null;
    }

    const messageContent = content.trim();
    
    // Создаем оптимистичное сообщение
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const user = getCurrentUser();
    const optimisticMessage = {
      id: tempId,
      tempId,
      chatId: parseInt(chatId),
      content: messageContent,
      type,
      status: MESSAGE_STATUS.SENDING,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      senderId: user?.id,
      senderUsername: user?.username,
      senderDisplayName: user?.displayName || user?.username,
    };
    
    // Сохраняем в очередь
    const queuedMessage = {
      ...optimisticMessage,
      retryCount: 0,
    };
    
    if (!saveMessageToQueue(queuedMessage)) {
      console.error('Не удалось сохранить сообщение в очередь');
      return null;
    }
    
    // Сохраняем ссылку на последнее отправленное сообщение для связи с подтверждением
    lastSentMessageRef.current = queuedMessage;
    
    // НЕ вызываем callback для оптимистичного сообщения - оно появится только после получения от сервера

    setSending(true);

    try {
      // Проверяем состояние WebSocket более тщательно
      const isWebSocketReady = client && 
                               client.connected && 
                               client.active && 
                               (connected || client.state === 1); // 1 = CONNECTED
      
      // Пробуем отправить через WebSocket
      if (isWebSocketReady) {
        try {
          const destination = '/app/chat.sendMessage';
          const messagePayload = {
            chatId: parseInt(chatId),
            content: messageContent,
            type,
          };
          
          client.publish({
            destination,
            body: JSON.stringify(messagePayload),
          });
          
          // WebSocket отправка успешна - НЕ отправляем через REST API
          // Статус обновится при получении подтверждения через подписку
          setSending(false);
          return { success: true };
        } catch (wsError) {
          console.error('Ошибка отправки через WebSocket:', wsError);
          // Продолжаем к fallback через REST API только при ошибке
        }
      }
      
      // Fallback: отправляем через REST API только если WebSocket недоступен или была ошибка
      
      const serverMessage = await chatAPI.sendMessage(chatId, messageContent, type);
      
      // Обновляем статус в очереди
      updateMessageStatus(queuedMessage.tempId, MESSAGE_STATUS.SENT, serverMessage);
      removeMessageFromQueue(queuedMessage.tempId);
      
      // Вызываем callback с реальным сообщением для замены оптимистичного
      if (onMessageSent) {
        onMessageSent(serverMessage, queuedMessage.tempId);
      }
      
      setSending(false);
      return serverMessage;
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      
      // Обновляем статус на FAILED
      updateMessageStatus(queuedMessage.tempId, MESSAGE_STATUS.FAILED);
      
      // Планируем повторную попытку через REST API
      scheduleRetry(queuedMessage, chatId, onMessageSent);
      
      // НЕ вызываем callback - сообщение останется в очереди для повторной попытки
      
      setSending(false);
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
    if (!chatId || !client || !connected) return;

    // Синхронизируем только сообщения со статусом SENDING (не отправленные)
    // Не синхронизируем сообщения, которые уже были отправлены через WebSocket
    const sendMessageFn = async (message) => {
      // Проверяем, что сообщение еще не отправлено
      if (message.status === MESSAGE_STATUS.SENT) {
        return null; // Пропускаем уже отправленные
      }
      
      // Если WebSocket готов, отправляем через него
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
          return { success: true }; // WebSocket отправка асинхронная
        } catch (error) {
          console.error('Ошибка отправки через WebSocket в syncQueue:', error);
          // Fallback к REST API
        }
      }
      
      // Fallback: отправляем через REST API
      return await chatAPI.sendMessage(chatId, message.content, message.type);
    };

    const results = await syncMessageQueue(sendMessageFn);
    
    // НЕ обновляем UI здесь - сообщения придут через WebSocket топик
    // Это предотвращает дубликаты

    return results;
  }, [chatId, client, connected]);

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
   * Подписывается на свои сообщения через /user/queue/messages
   * Это альтернативный способ получения подтверждений - получаем само сообщение
   */
  useEffect(() => {
    // Ждем подключения WebSocket
    if (!client || !connected) {
      return;
    }
    
    // Проверяем, что клиент действительно подключен и активен
    if (!client.connected || !client.active) {
      return;
    }
    
    // Отписываемся от старой подписки, если есть
    if (userMessagesSubscriptionRef.current) {
      try {
        userMessagesSubscriptionRef.current.unsubscribe();
      } catch (error) {
        // Игнорируем ошибки отписки
      }
      userMessagesSubscriptionRef.current = null;
    }
    
    try {
      const subscription = client.subscribe('/user/queue/messages', (message) => {
        try {
          const messageDto = JSON.parse(message.body);
          
          // Дедупликация: проверяем, не обработали ли мы уже это сообщение
          const messageKey = messageDto.id ? `id:${messageDto.id}` : 
            `content:${messageDto.chatId}:${messageDto.content}:${messageDto.senderId}:${messageDto.createdAt}`;
          
          if (processedMessagesRef.current.has(messageKey)) {
            // Уже обработано, пропускаем
            return;
          }
          
          // Найти оптимистичное сообщение по tempId или по content + chatId + senderId
          if (onMessageSent) {
            // Сначала ищем по tempId в последнем отправленном сообщении
            let tempId = null;
            if (lastSentMessageRef.current && 
                lastSentMessageRef.current.chatId === messageDto.chatId &&
                lastSentMessageRef.current.content === messageDto.content &&
                Number(lastSentMessageRef.current.senderId) === Number(messageDto.senderId)) {
              tempId = lastSentMessageRef.current.tempId;
            } else {
              // Ищем в очереди
              const queue = getMessageQueue();
              const matchingMessage = queue.find(msg => 
                msg.chatId === messageDto.chatId &&
                msg.content === messageDto.content &&
                Number(msg.senderId) === Number(messageDto.senderId) &&
                msg.status === MESSAGE_STATUS.SENDING
              );
              if (matchingMessage) {
                tempId = matchingMessage.tempId;
              }
            }
            
            if (tempId) {
              // Помечаем как обработанное ДО вызова onMessageSent
              processedMessagesRef.current.add(messageKey);
              if (messageDto.id) {
                processedMessagesRef.current.add(`id:${messageDto.id}`);
              }
              
              // Обновляем статус в очереди
              updateMessageStatus(tempId, MESSAGE_STATUS.SENT, messageDto);
              
              // Удаляем из очереди после небольшой задержки
              setTimeout(() => {
                removeMessageFromQueue(tempId);
                if (lastSentMessageRef.current?.tempId === tempId) {
                  lastSentMessageRef.current = null;
                }
              }, 1000);
              
              // Заменяем оптимистичное сообщение на реальное
              onMessageSent({
                ...messageDto,
                status: MESSAGE_STATUS.SENT,
              }, tempId);
            } else {
              // Если не нашли tempId, но это наше сообщение - помечаем как обработанное
              // чтобы не обрабатывать его снова
              const user = getCurrentUser();
              if (user && Number(messageDto.senderId) === Number(user.id)) {
                processedMessagesRef.current.add(messageKey);
                if (messageDto.id) {
                  processedMessagesRef.current.add(`id:${messageDto.id}`);
                }
              }
            }
          }
        } catch (error) {
          console.error('Ошибка обработки сообщения из /user/queue/messages:', error);
        }
      });
      
      userMessagesSubscriptionRef.current = subscription;
      
      return () => {
        if (userMessagesSubscriptionRef.current) {
          userMessagesSubscriptionRef.current.unsubscribe();
          userMessagesSubscriptionRef.current = null;
        }
      };
    } catch (error) {
      console.error('Ошибка подписки на /user/queue/messages:', error);
    }
  }, [client, connected, onMessageSent]);

  /**
   * Подписывается на подтверждения отправки сообщений от бэкенда
   */
  useEffect(() => {
    // Ждем подключения WebSocket
    if (!client || !connected) {
      return;
    }
    
    // Проверяем, что клиент действительно подключен и активен
    if (!client.connected || !client.active) {
      return;
    }

    
    // Отписываемся от старой подписки, если есть
    if (messageSentSubscriptionRef.current) {
      try {
        messageSentSubscriptionRef.current.unsubscribe();
      } catch (error) {
        console.error('Ошибка отписки от старой подписки на подтверждения:', error);
      }
      messageSentSubscriptionRef.current = null;
    }
    
    try {
      const subscription = client.subscribe('/user/queue/message-sent', (message) => {
        try {
          const confirmation = JSON.parse(message.body);

          if (confirmation.status === 'sent') {
            // Дедупликация: проверяем, не обработали ли мы уже это подтверждение
            const confirmationKey = confirmation.messageId ? 
              `confirm:${confirmation.messageId}` : 
              `confirm:${confirmation.chatId}:${Date.now()}`;
            
            if (processedMessagesRef.current.has(confirmationKey)) {
              // Уже обработано, пропускаем
              return;
            }
            
            // Также проверяем по messageId, если он есть
            if (confirmation.messageId && processedMessagesRef.current.has(`id:${confirmation.messageId}`)) {
              // Уже обработано, пропускаем
              return;
            }
            
            let queuedMessage = null;
            
            // Сначала проверяем последнее отправленное сообщение
            if (lastSentMessageRef.current && 
                lastSentMessageRef.current.chatId === confirmation.chatId &&
                lastSentMessageRef.current.status === MESSAGE_STATUS.SENDING) {
              queuedMessage = lastSentMessageRef.current;
            } else {
              // Ищем в очереди по chatId и статусу SENDING
              const queue = getMessageQueue();
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
              // Помечаем как обработанное
              processedMessagesRef.current.add(confirmationKey);
              
              // Если есть messageId, также помечаем по нему
              if (confirmation.messageId) {
                processedMessagesRef.current.add(`id:${confirmation.messageId}`);
              }
              
              // Обновляем статус в очереди
              updateMessageStatus(queuedMessage.tempId, MESSAGE_STATUS.SENT);
              
              // Удаляем из очереди после небольшой задержки (чтобы UI успел обновиться)
              setTimeout(() => {
                removeMessageFromQueue(queuedMessage.tempId);
                if (lastSentMessageRef.current?.tempId === queuedMessage.tempId) {
                  lastSentMessageRef.current = null;
                }
              }, 1000);

              // Обновляем UI через callback - заменяем оптимистичное сообщение на реальное
              if (onMessageSent) {
                // Если в подтверждении есть полное сообщение, используем его
                if (confirmation.status === 'sent' && confirmation.message) {
                  onMessageSent({
                    ...confirmation.message,
                    status: MESSAGE_STATUS.SENT,
                  }, queuedMessage.tempId);
                } else {
                  // Иначе используем данные из очереди и messageId из подтверждения
                  onMessageSent({
                    id: confirmation.messageId,
                    status: MESSAGE_STATUS.SENT,
                    chatId: confirmation.chatId,
                    content: queuedMessage.content,
                    type: queuedMessage.type,
                    senderId: queuedMessage.senderId,
                    senderUsername: queuedMessage.senderUsername,
                    senderDisplayName: queuedMessage.senderDisplayName,
                    createdAt: queuedMessage.createdAt,
                  }, queuedMessage.tempId);
                }
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
              if (confirmation.errorMessage && typeof window !== 'undefined') {
                alert(`Не удалось отправить сообщение: ${confirmation.errorMessage}`);
              }

              // Планируем повторную попытку через REST API
              scheduleRetry(queuedMessage, confirmation.chatId, onMessageSent);
            }
          }
        } catch (error) {
          // Игнорируем ошибки обработки
        }
      });

            messageSentSubscriptionRef.current = subscription;


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

