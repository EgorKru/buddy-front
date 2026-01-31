import { useEffect, useRef, useCallback } from 'react';
import { useMessaging } from '@/context/messaging';
import { useStomp } from '@/context/socket';
import { getCurrentUser } from '@/utils/api';

/**
 * Хук для автоматической отметки сообщений как прочитанных при появлении в viewport
 * Логика как в Telegram - МОМЕНТАЛЬНО без задержек
 */
export const useMessageReadTracking = (chatId, enabled = true) => {
  const { upsertReadReceipt } = useMessaging();
  const { client, connected } = useStomp();
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
    
    console.log('[READ TRACKING] Marking message as read:', {
      chatId,
      messageId: msgId,
      userId: currentUser.id
    });
    
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
      console.log('[READ TRACKING] Sent markRead to server:', { chatId, lastReadMessageId: msgId });
    } catch (error) {
      console.error('[READ TRACKING] Failed to mark message as read:', error);
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
    
    console.log('[READ TRACKING] Initializing for chat:', chatId);
    
    // Создаем Intersection Observer с высокой чувствительностью
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const messageId = entry.target.getAttribute('data-message-id');
          
          console.log('[READ TRACKING] Intersection event:', {
            messageId,
            isIntersecting: entry.isIntersecting,
            intersectionRatio: entry.intersectionRatio,
            boundingClientRect: entry.boundingClientRect
          });
          
          // ЛЮБАЯ видимость - сразу помечаем прочитанным (как в Telegram)
          if (entry.isIntersecting) {
            if (messageId) {
              // БЕЗ ЗАДЕРЖЕК - мгновенно!
              markMessageAsRead(messageId);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '100px', // Увеличил запас до 100px
        threshold: [0, 0.01, 0.1], // Даже 1% видимости достаточно
      }
    );
    
    return () => {
      console.log('[READ TRACKING] Cleanup for chat:', chatId);
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
