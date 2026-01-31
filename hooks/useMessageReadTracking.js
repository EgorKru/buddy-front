import { useEffect, useRef, useCallback } from 'react';
import { useMessaging } from '@/context/messaging';
import { useStomp } from '@/context/socket';
import { getCurrentUser } from '@/utils/api';

/**
 * Хук для автоматической отметки сообщений как прочитанных
 * МОМЕНТАЛЬНО при любом просмотре - как в Telegram!
 * 
 * Отслеживает:
 * 1. Появление сообщения в viewport (IntersectionObserver)
 * 2. Возвращение на вкладку (visibilitychange)
 * 3. Прокрутку к сообщениям (scroll + intersection)
 * 4. Приход новых сообщений в открытый чат
 */
export const useMessageReadTracking = (chatId, enabled = true) => {
  const { upsertReadReceipt, messageIdsByChatId, messagesById } = useMessaging();
  const { client, connected } = useStomp();
  const observerRef = useRef(null);
  const processedMessagesRef = useRef(new Set());
  const lastReadMessageIdRef = useRef(null);
  const isVisibleRef = useRef(true);
  
  // Функция для отметки одного сообщения как прочитанного
  const markMessageAsRead = useCallback((messageId, source = 'intersection') => {
    if (!chatId || !messageId) return;
    if (!client || !connected) {
      console.log('[READ TRACKING] Cannot mark - not connected:', { chatId, messageId });
      return;
    }
    
    const msgId = parseInt(messageId);
    if (isNaN(msgId)) return;
    
    const key = `${chatId}-${msgId}`;
    
    // Не обрабатываем дважды
    if (processedMessagesRef.current.has(key)) {
      console.log('[READ TRACKING] Message already processed:', { chatId, messageId, source });
      return;
    }
    
    processedMessagesRef.current.add(key);
    
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return;
    
    // Проверяем, что это не наше собственное сообщение
    const cid = String(chatId);
    const messageIds = messageIdsByChatId?.[cid] || [];
    const message = messagesById?.[String(msgId)];
    
    if (message && currentUser.id === message.senderId) {
      console.log('[READ TRACKING] Skipping own message:', { chatId, messageId });
      return;
    }
    
    console.log('[READ TRACKING] Marking message as read:', {
      chatId,
      messageId: msgId,
      userId: currentUser.id,
      source,
      visible: isVisibleRef.current
    });
    
    // Запоминаем последнее прочитанное сообщение
    if (!lastReadMessageIdRef.current || msgId > lastReadMessageIdRef.current) {
      lastReadMessageIdRef.current = msgId;
    }
    
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
      console.log('[READ TRACKING] Sent markRead to server:', { 
        chatId, 
        lastReadMessageId: msgId,
        source 
      });
    } catch (error) {
      console.error('[READ TRACKING] Failed to mark message as read:', error);
      // Даже если ошибка - локально уже помечено
    }
  }, [chatId, client, connected, upsertReadReceipt, messageIdsByChatId, messagesById]);
  
  // Функция для отметки всех видимых сообщений как прочитанных
  const markAllVisibleAsRead = useCallback(() => {
    if (!enabled || !chatId || !observerRef.current) return;
    
    console.log('[READ TRACKING] Marking all visible messages as read');
    
    // Получаем все наблюдаемые элементы
    const entries = observerRef.current.takeRecords();
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const messageId = entry.target.getAttribute('data-message-id');
        if (messageId) {
          markMessageAsRead(messageId, 'visibility-batch');
        }
      }
    });
    
    // Также проверяем все элементы с data-message-id в viewport
    if (typeof document !== 'undefined') {
      const messageElements = document.querySelectorAll('[data-message-id]');
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
            markMessageAsRead(messageId, 'visibility-check');
          }
        }
      });
    }
  }, [enabled, chatId, markMessageAsRead]);
  
  const observeMessage = useCallback((element) => {
    if (!element || !observerRef.current) return;
    observerRef.current.observe(element);
    
    // Сразу проверяем видимость при добавлении элемента
    const rect = element.getBoundingClientRect();
    const isVisible = (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
    
    if (isVisible && isVisibleRef.current) {
      const messageId = element.getAttribute('data-message-id');
      if (messageId) {
        // Небольшая задержка для обеспечения полного рендеринга
        requestAnimationFrame(() => {
          markMessageAsRead(messageId, 'immediate-observe');
        });
      }
    }
  }, [markMessageAsRead]);
  
  const unobserveMessage = useCallback((element) => {
    if (!element || !observerRef.current) return;
    observerRef.current.unobserve(element);
  }, []);
  
  useEffect(() => {
    if (!enabled || !chatId) return;
    
    console.log('[READ TRACKING] Initializing for chat:', chatId);
    
    // Отслеживаем видимость страницы
    isVisibleRef.current = typeof document !== 'undefined' ? 
      document.visibilityState === 'visible' : true;
    
    // Создаем Intersection Observer с максимальной чувствительностью
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const messageId = entry.target.getAttribute('data-message-id');
          
          console.log('[READ TRACKING] Intersection event:', {
            messageId,
            isIntersecting: entry.isIntersecting,
            intersectionRatio: entry.intersectionRatio,
            visible: isVisibleRef.current
          });
          
          // ЛЮБАЯ видимость + страница активна = сразу помечаем прочитанным
          if (entry.isIntersecting && isVisibleRef.current) {
            if (messageId) {
              // БЕЗ ЗАДЕРЖЕК - мгновенно!
              markMessageAsRead(messageId, 'intersection');
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '200px', // Большой запас для предзагрузки
        threshold: [0, 0.01, 0.1, 0.5, 1.0], // Множество порогов
      }
    );
    
    // Обработчик возвращения на вкладку
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      isVisibleRef.current = isVisible;
      
      console.log('[READ TRACKING] Visibility changed:', { 
        chatId, 
        visible: isVisible 
      });
      
      if (isVisible) {
        // Когда возвращаемся на вкладку - помечаем все видимые сообщения
        setTimeout(() => {
          markAllVisibleAsRead();
        }, 100);
      }
    };
    
    // Обработчик focus окна
    const handleFocus = () => {
      console.log('[READ TRACKING] Window focused:', chatId);
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          markAllVisibleAsRead();
        }, 100);
      }
    };
    
    // Подписываемся на события
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
    }
    
    // Начальная отметка видимых сообщений
    if (isVisibleRef.current) {
      setTimeout(() => {
        markAllVisibleAsRead();
      }, 300);
    }
    
    return () => {
      console.log('[READ TRACKING] Cleanup for chat:', chatId);
      
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      }
      
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      
      processedMessagesRef.current.clear();
      lastReadMessageIdRef.current = null;
    };
  }, [enabled, chatId, markMessageAsRead, markAllVisibleAsRead]);
  
  return {
    observeMessage,
    unobserveMessage,
    markMessageAsRead, // Экспортируем для ручного использования
    markAllVisibleAsRead, // Экспортируем для ручного использования
  };
};
