import { useState, useEffect, useRef, useCallback } from 'react';
import { useStomp } from '@/context/socket';
import { chatAPI } from '@/utils/api';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import { useChats } from '@/context/messaging';

export const usePinnedMessages = (chatId, messages) => {
  const { client, connected } = useStomp();
  const { updateMessage, removeMessage } = useChats();

  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [viewedPinnedMessageId, setViewedPinnedMessageId] = useState(null);

  const pinnedSubRef = useRef(null);
  const unpinnedSubRef = useRef(null);
  const deletedForMeSubRef = useRef(null);
  const deletedForAllSubRef = useRef(null);
  const loadingPinnedRef = useRef(false);
  const lastLoadedChatIdRef = useRef(null);

  const loadPinnedMessages = useCallback(async () => {
    if (!chatId) return;
    const chatIdStr = String(chatId);

    if (loadingPinnedRef.current && lastLoadedChatIdRef.current === chatIdStr) {
      return;
    }

    loadingPinnedRef.current = true;
    lastLoadedChatIdRef.current = chatIdStr;

    try {
      const pinned = await chatAPI.getPinnedMessages(chatId);
      const sorted = Array.isArray(pinned)
        ? [...pinned].sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0))
        : [];
      setPinnedMessages(sorted);
      setViewedPinnedMessageId(null);
    } catch (error) {
    } finally {
      loadingPinnedRef.current = false;
    }
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !client || !connected || !client.connected || !client.active) {
      if (pinnedSubRef.current) {
        safeUnsubscribe(pinnedSubRef.current);
        pinnedSubRef.current = null;
      }
      if (unpinnedSubRef.current) {
        safeUnsubscribe(unpinnedSubRef.current);
        unpinnedSubRef.current = null;
      }
      if (deletedForMeSubRef.current) {
        safeUnsubscribe(deletedForMeSubRef.current);
        deletedForMeSubRef.current = null;
      }
      if (deletedForAllSubRef.current) {
        safeUnsubscribe(deletedForAllSubRef.current);
        deletedForAllSubRef.current = null;
      }
      return;
    }

    if (pinnedSubRef.current) {
      safeUnsubscribe(pinnedSubRef.current);
      pinnedSubRef.current = null;
    }
    if (unpinnedSubRef.current) {
      safeUnsubscribe(unpinnedSubRef.current);
      unpinnedSubRef.current = null;
    }
    if (deletedForMeSubRef.current) {
      safeUnsubscribe(deletedForMeSubRef.current);
      deletedForMeSubRef.current = null;
    }
    if (deletedForAllSubRef.current) {
      safeUnsubscribe(deletedForAllSubRef.current);
      deletedForAllSubRef.current = null;
    }

    try {
      const pinnedSub = client.subscribe(`/topic/chat/${chatId}/pinned`, (message) => {
        const event = safeJsonParse(message.body);
        if (!event || event.eventType !== 'MESSAGE_PINNED') return;
        if (!event.pinnedMessage) return;

        const eventChatId = event.pinnedMessage.chatId;
        if (Number(eventChatId) !== Number(chatId)) return;

        const pinnedMsg = event.pinnedMessage?.message;
        const pinnedMsgId = pinnedMsg?.id;

        if (!pinnedMsgId) return;

        updateMessage({ ...pinnedMsg, isPinned: true }, { unreadDelta: 0 });

        setPinnedMessages((prev) => {
          const existingIndex = prev.findIndex((p) => {
            const pMsgId = p.message?.id;
            return pMsgId && Number(pMsgId) === Number(pinnedMsgId);
          });

          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = event.pinnedMessage;
            const sorted = updated.sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0));

            if (
              sorted[0] &&
              sorted[0].message?.id &&
              Number(sorted[0].message.id) === Number(pinnedMsgId)
            ) {
              setViewedPinnedMessageId(null);
            }

            return sorted;
          }

          const updated = [...prev, event.pinnedMessage];
          const sorted = updated.sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0));
          setViewedPinnedMessageId(null);

          return sorted;
        });
      });
      pinnedSubRef.current = pinnedSub;

      const unpinnedSub = client.subscribe(`/topic/chat/${chatId}/unpinned`, (message) => {
        const event = safeJsonParse(message.body);
        if (!event || event.eventType !== 'MESSAGE_UNPINNED') return;
        if (Number(event.chatId) !== Number(chatId)) return;

        if (event.messageId) {
          const messageToUpdate = messages.find((m) => Number(m.id) === Number(event.messageId));
          if (messageToUpdate) {
            updateMessage({ ...messageToUpdate, isPinned: false }, { unreadDelta: 0 });
          }
        }

        setPinnedMessages((prev) =>
          prev.filter((p) => {
            const pMsgId = p.message?.id;
            return !pMsgId || Number(pMsgId) !== Number(event.messageId);
          })
        );

        setViewedPinnedMessageId((prev) => {
          if (prev && Number(prev) === Number(event.messageId)) {
            return null;
          }
          return prev;
        });
      });
      unpinnedSubRef.current = unpinnedSub;

      const deletedForMeSub = client.subscribe('/user/queue/message-deleted', (message) => {
        const event = safeJsonParse(message.body);
        if (!event || event.eventType !== 'MESSAGE_DELETED_FOR_ME') return;
        if (!event.messageId) return;

        const deletedMessageId = Number(event.messageId);

        setPinnedMessages((prev) => {
          const filtered = prev.filter((p) => {
            const pMsgId = p.message?.id || p.id;
            return !pMsgId || Number(pMsgId) !== deletedMessageId;
          });
          return filtered;
        });

        setViewedPinnedMessageId((prev) => {
          if (prev && Number(prev) === deletedMessageId) {
            return null;
          }
          return prev;
        });

        removeMessage(chatId, deletedMessageId, true, false);
      });
      deletedForMeSubRef.current = deletedForMeSub;

      const deletedForAllSub = client.subscribe(`/topic/chat/${chatId}/deleted`, (message) => {
        const event = safeJsonParse(message.body);
        if (!event || event.eventType !== 'MESSAGE_DELETED_FOR_ALL') return;
        if (Number(event.chatId) !== Number(chatId)) return;
        if (!event.messageId) return;

        const deletedMessageId = Number(event.messageId);

        setPinnedMessages((prev) => {
          const filtered = prev.filter((p) => {
            const pMsgId = p.message?.id || p.id;
            return !pMsgId || Number(pMsgId) !== deletedMessageId;
          });
          return filtered;
        });

        setViewedPinnedMessageId((prev) => {
          if (prev && Number(prev) === deletedMessageId) {
            return null;
          }
          return prev;
        });

        removeMessage(chatId, deletedMessageId, false, true);
      });
      deletedForAllSubRef.current = deletedForAllSub;
    } catch (e) {}

    return () => {
      if (pinnedSubRef.current) {
        safeUnsubscribe(pinnedSubRef.current);
        pinnedSubRef.current = null;
      }
      if (unpinnedSubRef.current) {
        safeUnsubscribe(unpinnedSubRef.current);
        unpinnedSubRef.current = null;
      }
      if (deletedForMeSubRef.current) {
        safeUnsubscribe(deletedForMeSubRef.current);
        deletedForMeSubRef.current = null;
      }
      if (deletedForAllSubRef.current) {
        safeUnsubscribe(deletedForAllSubRef.current);
        deletedForAllSubRef.current = null;
      }
    };
  }, [chatId, client, connected, updateMessage, messages, removeMessage]);

  return {
    pinnedMessages,
    viewedPinnedMessageId,
    setViewedPinnedMessageId,
    setPinnedMessages,
    loadPinnedMessages,
  };
};
