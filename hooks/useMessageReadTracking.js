import { useEffect, useRef, useCallback } from 'react';
import { useChats } from '@/context/messaging';

/**
 * Хук для автоматической отметки сообщений как прочитанных при появлении в viewport
 * Использует Intersection Observer для отслеживания видимости
 */
export const useMessageReadTracking = (chatId, enabled = true) => {
  const { markChatAsRead, client, connected } = useChats();
  const observerRef = useRef(null);
  const lastReadMessageIdRef = useRef(null);
  const pendingMarkRef = useRef(null);
  
  const markAsReadThrottled = useCallback((messageId) => {
    if (!chatId || !client || !connected || !messageId) return;
    
    const msgId = parseInt(messageId);
    
    // Не отправляем если уже прочитано
    if (lastReadMessageIdRef.current && msgId <= lastReadMessageIdRef.current) {
      return;
    }
    
    lastReadMessageIdRef.current = msgId;
    
    // Отменяем предыдущий таймаут
    if (pendingMarkRef.current) {
      clearTimeout(pendingMarkRef.current);
    }
    
    // Отправляем с небольшой задержкой для батчинга
    pendingMarkRef.current = setTimeout(() => {
      try {
        client.publish({
          destination: '/app/chat.markRead',
          body: JSON.stringify({
            chatId: parseInt(chatId),
            lastReadMessageId: msgId,
          }),
        });
        
        // Также вызываем полный markChatAsRead для обновления локального состояния
        markChatAsRead(chatId);
      } catch (error) {
        console.error('Failed to mark message as read:', error);
      }
      
      pendingMarkRef.current = null;
    }, 100); // 100мс для батчинга нескольких сообщений
  }, [chatId, client, connected, markChatAsRead]);
  
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
    
    // Создаем Intersection Observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Сообщение стало видимым
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const messageId = entry.target.getAttribute('data-message-id');
            if (messageId) {
              markAsReadThrottled(messageId);
            }
          }
        });
      },
      {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0.5, // 50% сообщения должно быть видно
      }
    );
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      
      if (pendingMarkRef.current) {
        clearTimeout(pendingMarkRef.current);
        pendingMarkRef.current = null;
      }
    };
  }, [enabled, chatId, markAsReadThrottled]);
  
  return {
    observeMessage,
    unobserveMessage,
  };
};
