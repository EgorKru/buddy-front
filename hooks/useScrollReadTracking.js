import { useEffect, useCallback, useRef } from 'react';
import { useStomp } from '@/context/socket';
import { useMessaging } from '@/context/messaging';
import { getCurrentUser } from '@/utils/api';

/**
 * Хук для отметки сообщений как прочитанных при прокрутке
 * Работает в дополнение к IntersectionObserver для максимальной надежности
 */
export const useScrollReadTracking = (chatId, enabled = true) => {
  const stompContext = useStomp();
  const messagingContext = useMessaging();
  
  // Защита от SSR - если контекст не доступен, возвращаем заглушки
  if (!stompContext || !messagingContext) {
    return {
      handleScroll: () => {},
      markVisibleMessagesAsRead: () => {},
    };
  }
  
  const { client, connected } = stompContext;
  const { upsertReadReceipt, messageIdsByChatId, messagesById } = messagingContext;
  const processedRef = useRef(new Set());
  const scrollTimerRef = useRef(null);
  const lastScrollTimeRef = useRef(0);
  
  const markVisibleMessagesAsRead = useCallback(() => {
    if (!enabled || !chatId || !client || !connected) return;
    if (typeof document === 'undefined') return;
    
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return;
    
    // Находим все видимые сообщения с data-message-id
    const messageElements = document.querySelectorAll('[data-message-id]');
    const visibleMessages = [];
    
    messageElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const isVisible = (
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0
      );
      
      if (isVisible) {
        const messageId = element.getAttribute('data-message-id');
        if (messageId) {
          const msgId = parseInt(messageId);
          if (!isNaN(msgId)) {
            visibleMessages.push(msgId);
          }
        }
      }
    });
    
    if (visibleMessages.length === 0) return;
    
    // Находим максимальный ID среди видимых сообщений
    const maxVisibleMessageId = Math.max(...visibleMessages);
    const key = `${chatId}-${maxVisibleMessageId}`;
    
    // Проверяем, не обрабатывали ли мы уже это сообщение
    if (processedRef.current.has(key)) return;
    
    // Проверяем, что это не наше сообщение
    const cid = String(chatId);
    const message = messagesById?.[String(maxVisibleMessageId)];
    if (message && currentUser.id === message.senderId) return;
    
    processedRef.current.add(key);
    
    console.log('[SCROLL READ TRACKING] Marking messages as read:', {
      chatId,
      maxMessageId: maxVisibleMessageId,
      visibleCount: visibleMessages.length,
      userId: currentUser.id
    });
    
    // Локально обновляем read receipt
    const now = new Date().toISOString();
    upsertReadReceipt(chatId, currentUser.id, now);
    
    // Отправляем на сервер
    try {
      client.publish({
        destination: '/app/chat.markRead',
        body: JSON.stringify({
          chatId: parseInt(chatId),
          lastReadMessageId: maxVisibleMessageId,
        }),
      });
      
      console.log('[SCROLL READ TRACKING] Sent to server:', {
        chatId,
        lastReadMessageId: maxVisibleMessageId
      });
    } catch (error) {
      console.error('[SCROLL READ TRACKING] Failed to send:', error);
    }
  }, [enabled, chatId, client, connected, upsertReadReceipt, messageIdsByChatId, messagesById]);
  
  const handleScroll = useCallback(() => {
    if (!enabled) return;
    
    const now = Date.now();
    // Дебаунсинг: не чаще раза в 200мс
    if (now - lastScrollTimeRef.current < 200) {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      scrollTimerRef.current = setTimeout(() => {
        markVisibleMessagesAsRead();
        lastScrollTimeRef.current = Date.now();
      }, 200);
      return;
    }
    
    lastScrollTimeRef.current = now;
    markVisibleMessagesAsRead();
  }, [enabled, markVisibleMessagesAsRead]);
  
  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      processedRef.current.clear();
    };
  }, [chatId]);
  
  return {
    handleScroll,
    markVisibleMessagesAsRead,
  };
};
