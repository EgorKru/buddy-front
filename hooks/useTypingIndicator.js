import { useState, useCallback, useEffect, useRef } from 'react';
import { useStomp } from '@/context/socket';
import { safeJsonParse } from '@/utils/safe';

const TYPING_TIMEOUT = 3000; // 3 секунды - время показа индикатора
const TYPING_SEND_THROTTLE = 2000; // Отправлять не чаще чем раз в 2 секунды

/**
 * Хук для работы с индикатором печати
 *
 * @param {number|string} chatId - ID чата
 * @returns {Object} - Объект с методами и состоянием
 */
export const useTypingIndicator = (chatId) => {
  const { client, connected } = useStomp();

  // Map для хранения пользователей которые печатают: userId -> timestamp
  const [typingUsers, setTypingUsers] = useState(new Map());

  const typingTimeoutRef = useRef(new Map()); // Таймауты для очистки typing
  const lastSentRef = useRef(0); // Время последней отправки typing
  const subscriptionRef = useRef(null);
  const isTypingRef = useRef(false); // Флаг что мы печатаем

  /**
   * Отправить уведомление о том, что начали/закончили печатать
   */
  const sendTyping = useCallback(
    (isTyping) => {
      if (!client || !connected || !chatId) return;

      const now = Date.now();

      // Throttle: не отправлять чаще чем раз в TYPING_SEND_THROTTLE мс
      if (isTyping && now - lastSentRef.current < TYPING_SEND_THROTTLE) {
        return;
      }

      lastSentRef.current = now;
      isTypingRef.current = isTyping;

      try {
        client.publish({
          destination: '/app/chat.typing',
          body: JSON.stringify({
            chatId: parseInt(chatId),
            typing: isTyping,
          }),
        });
      } catch (error) {
        console.error('Failed to send typing indicator:', error);
      }
    },
    [client, connected, chatId]
  );

  /**
   * Вызвать когда пользователь начал печатать
   */
  const startTyping = useCallback(() => {
    if (!isTypingRef.current) {
      sendTyping(true);
    }
  }, [sendTyping]);

  /**
   * Вызвать когда пользователь закончил печатать
   */
  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      sendTyping(false);
      isTypingRef.current = false;
    }
  }, [sendTyping]);

  /**
   * Обработчик события от другого пользователя
   */
  const handleTypingEvent = useCallback((event) => {
    if (!event || !event.userId) return;

    const userId = String(event.userId);
    const timestamp = Date.now();

    if (event.typing) {
      // Пользователь начал печатать
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(userId, timestamp);
        return next;
      });

      // Очистить предыдущий таймаут если был
      if (typingTimeoutRef.current.has(userId)) {
        clearTimeout(typingTimeoutRef.current.get(userId));
      }

      // Установить новый таймаут для автоматической очистки
      const timeout = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
        typingTimeoutRef.current.delete(userId);
      }, TYPING_TIMEOUT);

      typingTimeoutRef.current.set(userId, timeout);
    } else {
      // Пользователь закончил печатать
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });

      // Очистить таймаут
      if (typingTimeoutRef.current.has(userId)) {
        clearTimeout(typingTimeoutRef.current.get(userId));
        typingTimeoutRef.current.delete(userId);
      }
    }
  }, []);

  /**
   * Подписка на события typing в чате
   */
  useEffect(() => {
    if (!client || !connected || !chatId) return;

    // Отписаться от предыдущей подписки
    if (subscriptionRef.current) {
      try {
        subscriptionRef.current.unsubscribe();
      } catch (e) {
        console.error('Failed to unsubscribe from typing:', e);
      }
      subscriptionRef.current = null;
    }

    try {
      // Подписаться на события typing в чате
      const subscription = client.subscribe(`/topic/chat/${chatId}/typing`, (message) => {
        const event = safeJsonParse(message.body);
        if (event) {
          handleTypingEvent(event);
        }
      });

      subscriptionRef.current = subscription;
    } catch (error) {
      console.error('Failed to subscribe to typing:', error);
    }

    return () => {
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe();
        } catch (e) {
          console.error('Failed to unsubscribe from typing:', e);
        }
        subscriptionRef.current = null;
      }
    };
  }, [client, connected, chatId, handleTypingEvent]);

  /**
   * Очистить все при размонтировании
   */
  useEffect(() => {
    return () => {
      // Отправить что закончили печатать
      if (isTypingRef.current) {
        stopTyping();
      }

      // Очистить все таймауты
      typingTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutRef.current.clear();
    };
  }, [stopTyping]);

  /**
   * Получить массив ID пользователей которые печатают
   */
  const getTypingUserIds = useCallback(() => {
    return Array.from(typingUsers.keys());
  }, [typingUsers]);

  /**
   * Проверить печатает ли конкретный пользователь
   */
  const isUserTyping = useCallback(
    (userId) => {
      return typingUsers.has(String(userId));
    },
    [typingUsers]
  );

  return {
    // Методы
    startTyping,
    stopTyping,

    // Состояние
    typingUsers,
    typingUserIds: getTypingUserIds(),
    isUserTyping,
    hasTypingUsers: typingUsers.size > 0,
  };
};

export default useTypingIndicator;
