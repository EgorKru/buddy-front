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
  const voiceTopicSubRef = useRef(null);

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
    if (!chatId || !client || !connected || !client.connected || !client.active) {
      if (topicSubRef.current) {
        safeUnsubscribe(topicSubRef.current);
        topicSubRef.current = null;
      }
      if (voiceTopicSubRef.current) {
        safeUnsubscribe(voiceTopicSubRef.current);
        voiceTopicSubRef.current = null;
      }
      return;
    }

    if (topicSubRef.current) {
      safeUnsubscribe(topicSubRef.current);
      topicSubRef.current = null;
    }

    if (voiceTopicSubRef.current) {
      safeUnsubscribe(voiceTopicSubRef.current);
      voiceTopicSubRef.current = null;
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

    try {
      const voiceSub = client.subscribe(`/topic/voice/${chatId}`, (message) => {
        const data = safeJsonParse(message.body);
        if (!data) return;
        if (Number(data.chatId) !== Number(chatId)) return;

        if (data.audioData && typeof window !== 'undefined') {
          const audioBlob = new Blob([
            Uint8Array.from(atob(data.audioData), c => c.charCodeAt(0))
          ], { type: 'audio/webm' });
          
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.play().catch(() => {});
          
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
          };
        }
      });
      voiceTopicSubRef.current = voiceSub;
    } catch (e) {}

    return () => {
      if (topicSubRef.current) {
        safeUnsubscribe(topicSubRef.current);
        topicSubRef.current = null;
      }
      if (voiceTopicSubRef.current) {
        safeUnsubscribe(voiceTopicSubRef.current);
        voiceTopicSubRef.current = null;
      }
    };
  }, [chatId, client, connected, upsertMessage, markChatAsRead]);
};


