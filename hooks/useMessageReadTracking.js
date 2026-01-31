import { useEffect, useRef, useCallback } from 'react';
import { useChats } from '@/context/messaging';
import { getCurrentUser } from '@/utils/api';

/**
 * Хук для автоматической отметки сообщений как прочитанных при появлении в viewport
 * Логика как в Telegram - МОМЕНТАЛЬНО без задержек
 */
export const useMessageReadTracking = (chatId, enabled = true) => {
  const { client, connected, readAtByChatIdByUserId, upsertReadReceipt } = useChats();
  const observerRef = useRef(null);
  const processedMessagesRef = useRef(new Set());
  
  const markMessageAsRead = useCallback((messageId) => {
    if (!chatId || !messageId || !client || !connected) return;
    
    const msgId = parseInt(messageId);
    const key = `${chatId}-${msgId}`;
    
    // Не обрабатываем дважды
    if (processedMessagesRef.current.has(key)) return;
    processedMessagesRef.current.add(key);
    
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return;
    
    // 1. СРАЗУ локально помечаем как прочитанное (оптимистично)
    const now = new Date().toISOString();
    upsertReadReceipt(chatId, currentUser.id, now);
    
    // 2. Отправляем на сервер (параллельно, не ждем)
    try {
      client.publish({
        destination: '/app/chat.markRead',
        body: JSON.stringify({
          chatId: parseInt(chatId),
          lastReadMessageId: msgId,
        }),
      });
    } catch (error) {
      console.error('Failed to mark message as read:', error);
      // Даже если ошибка - локально уже помечено
    }
  }, [chatId, client, connected, upsertReadReceipt]);
  
  const observeMessage = useCallback((element) => {
    if (!element || !observerRef.current) return;
    observerRef.current.observe(element);
  }, []);
  
  const unobserveMessage = useCallback((element) => {
    if (!element || !observerRef.current) return;
    observerRef.current.unobserve(element);
  }, []);
  
  useEffect(() => {
    if (!enabled || !chatId) return;
    
    // Создаем Intersection Observer с высокой чувствительностью
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // ЛЮБАЯ видимость - сразу помечаем прочитанным (как в Telegram)
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute('data-message-id');
            if (messageId) {
              // БЕЗ ЗАДЕРЖЕК - мгновенно!
              markMessageAsRead(messageId);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '50px', // Небольшой запас - помечаем чуть раньше
        threshold: [0, 0.1], // Даже 10% видимости достаточно
      }
    );
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      processedMessagesRef.current.clear();
    };
  }, [enabled, chatId, markMessageAsRead]);
  
  return {
    observeMessage,
    unobserveMessage,
  };
};
