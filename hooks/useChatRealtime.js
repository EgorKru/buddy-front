import { useEffect, useRef, useCallback } from 'react';
import { useStomp } from '@/context/socket';
import { chatAPI, getCurrentUser } from '@/utils/api';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import { useChats } from '@/context/messaging';
import { MESSAGE_STATUS } from '@/utils/messageQueue';

export const useChatRealtime = (chatId) => {
  const { client, connected } = useStomp();
  const {
    setActiveChatId,
    markChatAsRead,
    upsertMessage,
  } = useChats();

  const topicSubRef = useRef(null);

  const loadInitial = useCallback(async () => {
    if (!chatId) return;
    try {
      const response = await chatAPI.getMessages(chatId, { page: 0, size: 50 });
      const list = Array.isArray(response?.content) ? response.content : [];
      const ordered = [...list].reverse();
      for (const m of ordered) {
        upsertMessage({ ...m, status: MESSAGE_STATUS.SENT, isOptimistic: false }, { unreadDelta: 0 });
      }
    } catch (e) {}
  }, [chatId, upsertMessage]);

  useEffect(() => {
    if (!chatId) return;
    setActiveChatId(chatId);
    markChatAsRead(chatId);
    loadInitial();
    return () => setActiveChatId(null);
  }, [chatId, setActiveChatId, markChatAsRead, loadInitial]);

  useEffect(() => {
    if (!chatId || !client || !connected || !client.connected || !client.active) return;

    if (topicSubRef.current) {
      safeUnsubscribe(topicSubRef.current);
      topicSubRef.current = null;
    }

    try {
      const sub = client.subscribe(`/topic/chat/${chatId}`, (message) => {
        const dto = safeJsonParse(message.body);
        if (!dto) return;
        if (Number(dto.chatId) !== Number(chatId)) return;

        upsertMessage({ ...dto, status: MESSAGE_STATUS.SENT, isOptimistic: false });

        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          markChatAsRead(chatId);
        }
      });
      topicSubRef.current = sub;
    } catch (e) {}

    return () => {
      if (topicSubRef.current) {
        safeUnsubscribe(topicSubRef.current);
        topicSubRef.current = null;
      }
    };
  }, [chatId, client, connected, upsertMessage, markChatAsRead]);
};


