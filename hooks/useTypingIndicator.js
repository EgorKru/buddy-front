import { useState, useCallback, useEffect, useRef } from 'react';
import { useStomp } from '@/context/socket';
import { safeJsonParse } from '@/utils/safe';
import {
  getTypingUserIds,
  removeTypingUser,
  setTypingUser,
} from '@/shared/lib/chat/typingUsersState';

const TYPING_TIMEOUT = 3000;
const TYPING_SEND_THROTTLE = 2000;

/**
 * Хук для работы с индикатором печати
 *
 * @param {number|string} chatId - ID чата
 */
export const useTypingIndicator = (chatId) => {
  const { client, connected } = useStomp();

  const [typingUsers, setTypingUsers] = useState(new Map());

  const typingTimeoutRef = useRef(new Map());
  const lastSentRef = useRef(0);
  const subscriptionRef = useRef(null);
  const isTypingRef = useRef(false);

  const clearTypingTimeoutForUser = useCallback((userId) => {
    const id = String(userId);
    if (typingTimeoutRef.current.has(id)) {
      clearTimeout(typingTimeoutRef.current.get(id));
      typingTimeoutRef.current.delete(id);
    }
  }, []);

  const clearTypingForUser = useCallback(
    (userId) => {
      if (userId == null) return;
      clearTypingTimeoutForUser(userId);
      setTypingUsers((prev) => removeTypingUser(prev, userId));
    },
    [clearTypingTimeoutForUser]
  );

  const sendTyping = useCallback(
    (isTyping) => {
      if (!client || !connected || !chatId) return;

      const now = Date.now();
      if (isTyping && now - lastSentRef.current < TYPING_SEND_THROTTLE) {
        return;
      }

      lastSentRef.current = now;
      isTypingRef.current = isTyping;

      try {
        client.publish({
          destination: '/app/chat.typing',
          body: JSON.stringify({
            chatId: parseInt(chatId, 10),
            typing: isTyping,
          }),
        });
      } catch (error) {
        console.error('Failed to send typing indicator:', error);
      }
    },
    [client, connected, chatId]
  );

  const startTyping = useCallback(() => {
    if (!isTypingRef.current) {
      sendTyping(true);
    }
  }, [sendTyping]);

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      sendTyping(false);
      isTypingRef.current = false;
    }
  }, [sendTyping]);

  const handleTypingEvent = useCallback(
    (event) => {
      if (!event || event.userId == null) return;

      const userId = String(event.userId);

      if (event.typing) {
        setTypingUsers((prev) => setTypingUser(prev, userId));
        clearTypingTimeoutForUser(userId);

        const timeout = setTimeout(() => {
          setTypingUsers((prev) => removeTypingUser(prev, userId));
          typingTimeoutRef.current.delete(userId);
        }, TYPING_TIMEOUT);

        typingTimeoutRef.current.set(userId, timeout);
      } else {
        clearTypingForUser(userId);
      }
    },
    [clearTypingForUser, clearTypingTimeoutForUser]
  );

  useEffect(() => {
    if (!client || !connected || !chatId) return;

    if (subscriptionRef.current) {
      try {
        subscriptionRef.current.unsubscribe();
      } catch (e) {
        console.error('Failed to unsubscribe from typing:', e);
      }
      subscriptionRef.current = null;
    }

    try {
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

  useEffect(() => {
    return () => {
      if (isTypingRef.current) {
        stopTyping();
      }
      typingTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutRef.current.clear();
    };
  }, [stopTyping]);

  const isUserTyping = useCallback((userId) => typingUsers.has(String(userId)), [typingUsers]);

  return {
    startTyping,
    stopTyping,
    clearTypingForUser,
    typingUsers,
    typingUserIds: getTypingUserIds(typingUsers),
    isUserTyping,
    hasTypingUsers: typingUsers.size > 0,
  };
};

export default useTypingIndicator;
