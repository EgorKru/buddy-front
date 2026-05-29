import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { chatAPI, getCurrentUser, isAuthenticated, getToken } from '@/utils/api';
import { useStomp } from '@/context/socket';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import { playPagerNotificationSound } from '@/utils/pagerSound';
import { extractNotificationMessage } from '@/shared/lib/chat/realtimePayload';
import { enrichMessageWithReply } from '@/shared/lib/chat/replyTo';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import {
  messagingReducer as reducer,
  messagingActionTypes as actionTypes,
  messagingInitialState as initialState,
  getChatTime,
} from './messagingReducer';

export {
  messagingReducer,
  messagingActionTypes,
  messagingInitialState,
  getChatTime,
  sortChatsByTime,
} from './messagingReducer';

const MessagingContext = createContext(null);

const getNotificationChatId = (n) => {
  return n?.chatId ?? n?.message?.chatId ?? n?.payload?.chatId ?? null;
};

const getNotificationMessage = (n) => extractNotificationMessage(n);

const ensureArray = (v) => (Array.isArray(v) ? v : []);

export const useMessaging = () => {
  return useContext(MessagingContext);
};

export const useChats = () => {
  const ctx = useMessaging();
  if (!ctx) {
    return {
      chats: [],
      loading: false,
      refreshChats: async () => {},
      activeChatId: null,
      setActiveChatId: () => {},
      markChatAsRead: async () => {},
      readAtByChatIdByUserId: {},
      upsertReadReceipt: () => {},
      upsertMessage: () => {},
      updateMessage: () => {},
      addOptimistic: () => {},
      replaceOptimistic: () => {},
    };
  }
  return ctx;
};

export const useChatMessages = (chatId) => {
  const { messageIdsByChatId, messagesById } = useChats();
  const cid = chatId ? String(chatId) : null;
  return useMemo(() => {
    const ids = cid ? ensureArray(messageIdsByChatId[cid]) : [];
    return ids.map((id) => messagesById[String(id)]).filter(Boolean);
  }, [cid, messageIdsByChatId, messagesById]);
};

export const MessagingProvider = ({ children }) => {
  const { client, connected } = useStomp();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!isAuthenticated()) return;
    import('@/shared/lib/e2ee/directTextE2ee')
      .then((m) => {
        if (m.isE2eeEnabled()) return m.ensureIdentityKeyPublished();
      })
      .catch(() => {});
  }, []);

  const wsSubsRef = useRef({
    messages: null,
    notifications: null,
    presence: null,
    readReceipts: null,
  });
  const refreshMissingChatTimerRef = useRef(null);
  const readSubsRef = useRef(new Map());
  const refreshInFlightRef = useRef(false);
  const lastSoundAtRef = useRef(0);
  const processedMessageIdsRef = useRef(new Set());
  const lastTokenRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshChats = useCallback(async () => {
    if (!isAuthenticated()) return;
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const data = await chatAPI.getChats();
      dispatch({ type: actionTypes.SET_CHATS, payload: { chats: data } });

      if (Array.isArray(data) && data.length > 0) {
        const processReadReceipts = (chats) => {
          for (const chat of chats) {
            if (!chat?.id || !chat.readReceipts) continue;

            if (typeof chat.readReceipts === 'object') {
              const readReceipts = {};
              for (const [userId, lastReadAt] of Object.entries(chat.readReceipts)) {
                if (userId && lastReadAt != null) {
                  readReceipts[String(userId)] = lastReadAt;
                }
              }
              if (Object.keys(readReceipts).length > 0) {
                dispatch({
                  type: actionTypes.SET_READ_RECEIPTS_FOR_CHAT,
                  payload: { chatId: chat.id, readReceipts },
                });
              }
            }
          }
        };

        if (data.length > 20) {
          const BATCH_SIZE = 20;
          let index = 0;

          const processBatch = () => {
            const batch = data.slice(index, index + BATCH_SIZE);
            processReadReceipts(batch);
            index += BATCH_SIZE;

            if (index < data.length) {
              if (typeof window !== 'undefined' && window.requestIdleCallback) {
                window.requestIdleCallback(processBatch, { timeout: 50 });
              } else {
                setTimeout(processBatch, 0);
              }
            }
          };

          processBatch();
        } else {
          processReadReceipts(data);
        }
      }
    } catch (error) {
      if (error.message === 'Forbidden' || error.message === 'Unauthorized') {
        return;
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  const lastConnectedRef = useRef(false);
  const hasInitialLoadRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      dispatch({ type: actionTypes.SET_CHATS, payload: { chats: [] } });
      hasInitialLoadRef.current = false;
      lastConnectedRef.current = false;
      lastTokenRef.current = null;
      return;
    }

    const token = getToken();
    const tokenChanged = lastTokenRef.current !== token;

    if (tokenChanged) {
      lastTokenRef.current = token;
      hasInitialLoadRef.current = false;
    }

    if (connected && !lastConnectedRef.current) {
      lastConnectedRef.current = true;
      if (!hasInitialLoadRef.current) {
        hasInitialLoadRef.current = true;
        refreshChats();
      }
    } else if (!connected) {
      lastConnectedRef.current = false;
      if (!hasInitialLoadRef.current && !tokenChanged) {
        hasInitialLoadRef.current = true;
        refreshChats();
      }
    }
  }, [connected, refreshChats]);

  useEffect(() => {
    if (lastTokenRef.current === null) {
      lastTokenRef.current = getToken();
      return;
    }

    const handleAuthMaybeChanged = () => {
      const token = getToken();
      if (!token) {
        lastTokenRef.current = null;
        hasInitialLoadRef.current = false;
        dispatch({ type: actionTypes.SET_CHATS, payload: { chats: [] } });
        return;
      }
      if (lastTokenRef.current !== token) {
        lastTokenRef.current = token;
        hasInitialLoadRef.current = false;
        if (!connected) {
          refreshChats();
        }
      }
    };

    const onStorage = (e) => {
      if (e?.key === 'token') {
        handleAuthMaybeChanged();
      }
    };

    const onFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleAuthMaybeChanged();
      }
    };
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleAuthMaybeChanged();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [connected, refreshChats]);

  const setActiveChatId = useCallback((chatId) => {
    dispatch({ type: actionTypes.SET_ACTIVE_CHAT, payload: { chatId } });
  }, []);

  const markChatAsRead = useCallback(
    async (chatId) => {
      if (!chatId) return;
      const currentUser = getCurrentUser();
      const cid = String(chatId);

      // Получаем последнее сообщение для отправки read receipt
      const messageIds = ensureArray(stateRef.current.messageIdsByChatId[cid]);
      const lastReadMessageId = messageIds.length > 0 ? messageIds[messageIds.length - 1] : null;

      if (client && connected) {
        try {
          client.publish({
            destination: '/app/chat.markRead',
            body: JSON.stringify({
              chatId: parseInt(chatId),
              lastReadMessageId: parseInt(lastReadMessageId),
            }),
          });
        } catch (e) {
          console.error('Failed to send markRead via WebSocket:', e);
        }
      }

      // Обновляем локальное состояние
      if (currentUser?.id) {
        const now = new Date().toISOString();
        dispatch({
          type: actionTypes.APPLY_READ_RECEIPT,
          payload: { chatId, readerId: currentUser.id, readAt: now },
        });
      }

      dispatch({ type: actionTypes.MARK_CHAT_READ_LOCAL, payload: { chatId } });

      // Fallback на REST API
      try {
        await chatAPI.markChatAsRead(chatId);
      } catch (e) {}
    },
    [client, connected]
  );

  const upsertReadReceipt = useCallback((chatId, readerId, readAt) => {
    dispatch({ type: actionTypes.APPLY_READ_RECEIPT, payload: { chatId, readerId, readAt } });
  }, []);

  const setReadReceiptsForChat = useCallback((chatId, readReceipts) => {
    dispatch({ type: actionTypes.SET_READ_RECEIPTS_FOR_CHAT, payload: { chatId, readReceipts } });
  }, []);

  const upsertMessage = useCallback(
    (message, meta = {}) => {
      if (!message?.id || !message?.chatId) return;
      const enriched = enrichMessageWithReply(message, stateRef.current.messagesById);
      const mid = String(enriched.id);
      const alreadyInStore = Boolean(stateRef.current.messagesById[mid]);
      if (processedMessageIdsRef.current.has(mid) && alreadyInStore && !meta.force) {
        return;
      }

      const currentUser = getCurrentUser();
      const isOwn =
        currentUser?.id &&
        enriched?.senderId &&
        Number(currentUser.id) === Number(enriched.senderId);

      if (isOwn) {
        const cid = String(enriched.chatId);
        const existingIds = ensureArray(stateRef.current.messageIdsByChatId[cid]);
        const alreadyInList = existingIds.some((id) => String(id) === mid);
        if (alreadyInList) {
          processedMessageIdsRef.current.add(mid);
          return;
        }
      }

      processedMessageIdsRef.current.add(mid);

      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      const active =
        stateRef.current.activeChatId &&
        String(stateRef.current.activeChatId) === String(enriched.chatId);
      const unreadDelta = isOwn ? 0 : active && isVisible ? 0 : 1;

      dispatch({
        type: actionTypes.UPSERT_MESSAGE,
        payload: {
          message: enriched,
          chatId: enriched.chatId,
          unreadDelta: meta.unreadDelta ?? unreadDelta,
        },
      });

      const cid = String(enriched.chatId);
      if (!stateRef.current.chatsById[cid]) {
        if (refreshMissingChatTimerRef.current) {
          clearTimeout(refreshMissingChatTimerRef.current);
        }
        refreshMissingChatTimerRef.current = setTimeout(() => {
          refreshMissingChatTimerRef.current = null;
          refreshChats();
        }, 150);
      }
    },
    [refreshChats]
  );

  const updateMessage = useCallback((message, meta = {}) => {
    if (!message?.id || !message?.chatId) return;
    const enriched = enrichMessageWithReply(message, stateRef.current.messagesById);
    const mid = String(enriched.id);
    processedMessageIdsRef.current.delete(mid);

    const currentUser = getCurrentUser();
    const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    const active =
      stateRef.current.activeChatId &&
      String(stateRef.current.activeChatId) === String(enriched.chatId);
    const isOwn =
      currentUser?.id && enriched?.senderId && Number(currentUser.id) === Number(enriched.senderId);
    const unreadDelta = isOwn ? 0 : active && isVisible ? 0 : 1;

    dispatch({
      type: actionTypes.UPSERT_MESSAGE,
      payload: {
        message: enriched,
        chatId: enriched.chatId,
        unreadDelta: meta.unreadDelta ?? unreadDelta,
      },
    });
  }, []);

  const removeMessage = useCallback(
    (chatId, messageId, deletedForMe = false, deletedForAll = false) => {
      if (!chatId || !messageId) return;
      dispatch({
        type: actionTypes.REMOVE_MESSAGE,
        payload: { chatId, messageId, deletedForMe, deletedForAll },
      });
    },
    []
  );

  const addOptimistic = useCallback((chatId, optimisticMessage) => {
    const enriched = enrichMessageWithReply(optimisticMessage, stateRef.current.messagesById);
    dispatch({ type: actionTypes.ADD_OPTIMISTIC, payload: { chatId, message: enriched } });
  }, []);

  const replaceOptimistic = useCallback((chatId, tempId, serverMessage, status) => {
    const enriched = enrichMessageWithReply(serverMessage, stateRef.current.messagesById);
    if (enriched?.id) {
      const mid = String(enriched.id);
      processedMessageIdsRef.current.add(mid);
    }
    dispatch({
      type: actionTypes.REPLACE_OPTIMISTIC,
      payload: { chatId, tempId, message: enriched, status },
    });
  }, []);

  const maybeSound = useCallback((notification) => {
    try {
      if (typeof window === 'undefined') return;
      const disabled = localStorage.getItem('disable_notification_sound') === 'true';
      if (disabled) return;

      const msg = getNotificationMessage(notification);
      const cid = getNotificationChatId(notification);
      if (!msg || !cid) return;
      const currentUser = getCurrentUser();
      const isOwn =
        currentUser?.id && msg?.senderId && Number(currentUser.id) === Number(msg.senderId);
      if (isOwn) return;

      const active =
        stateRef.current.activeChatId && String(stateRef.current.activeChatId) === String(cid);
      if (active) return;

      const now = Date.now();
      if (now - lastSoundAtRef.current < 500) return;
      lastSoundAtRef.current = now;
      playPagerNotificationSound({ pattern: 'pager' });
    } catch (e) {}
  }, []);

  const markActiveChatReadIfVisible = useCallback(() => {
    const activeChatId = stateRef.current.activeChatId;
    if (!activeChatId) return;
    const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    if (!isVisible) return;

    dispatch({ type: actionTypes.MARK_CHAT_READ_LOCAL, payload: { chatId: activeChatId } });
    markChatAsRead(activeChatId);
  }, [markChatAsRead]);

  useEffect(() => {
    markActiveChatReadIfVisible();
  }, [state.activeChatId, markActiveChatReadIfVisible]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleReturnToChat = () => {
      markActiveChatReadIfVisible();
    };

    document.addEventListener('visibilitychange', handleReturnToChat);
    window.addEventListener('focus', handleReturnToChat);
    return () => {
      document.removeEventListener('visibilitychange', handleReturnToChat);
      window.removeEventListener('focus', handleReturnToChat);
    };
  }, [markActiveChatReadIfVisible]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    if (!client || !connected) return;

    const cleanup = () => {
      safeUnsubscribe(wsSubsRef.current.messages);
      safeUnsubscribe(wsSubsRef.current.notifications);
      safeUnsubscribe(wsSubsRef.current.presence);
      safeUnsubscribe(wsSubsRef.current.readReceipts);
      wsSubsRef.current.messages = null;
      wsSubsRef.current.notifications = null;
      wsSubsRef.current.presence = null;
      wsSubsRef.current.readReceipts = null;
    };
    cleanup();

    try {
      wsSubsRef.current.messages = client.subscribe('/user/queue/messages', (m) => {
        const notif = safeJsonParse(m.body);
        if (!notif) return;
        const msg = getNotificationMessage(notif);
        if (msg?.id) {
          upsertMessage(msg);
        }
        maybeSound(notif);
      });
    } catch (e) {}

    try {
      wsSubsRef.current.notifications = client.subscribe('/user/queue/notifications', (m) => {
        const notif = safeJsonParse(m.body);
        if (!notif) return;
        const msg = getNotificationMessage(notif);
        if (msg?.id) {
          upsertMessage(msg);
        }
        maybeSound(notif);
      });

      wsSubsRef.current.presence = client.subscribe('/user/queue/presence', (m) => {
        const event = safeJsonParse(m.body);
        if (!event?.userId) return;
        dispatch({
          type: actionTypes.UPDATE_PRESENCE,
          payload: {
            userId: event.userId,
            online: event.online,
            busy: event.busy,
            lastSeenAt: event.lastSeenAt,
          },
        });
      });

      wsSubsRef.current.readReceipts = client.subscribe('/user/queue/read-receipts', (m) => {
        const ev = safeJsonParse(m.body);
        if (!ev?.chatId || !ev?.readerId || !ev?.readAt) return;
        upsertReadReceipt(ev.chatId, ev.readerId, ev.readAt);
      });
    } catch (e) {}

    return () => cleanup();
  }, [client, connected, upsertMessage, maybeSound, upsertReadReceipt]);

  useEffect(() => {
    processedMessageIdsRef.current.clear();
  }, [state.activeChatId]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    if (!client || !connected) return;

    const chatIds = new Set(Object.keys(state.chatsById).map(String));
    if (state.activeChatId) {
      chatIds.add(String(state.activeChatId));
    }

    for (const [cid, sub] of readSubsRef.current.entries()) {
      if (!chatIds.has(cid)) {
        safeUnsubscribe(sub);
        readSubsRef.current.delete(cid);
      }
    }

    for (const cid of chatIds) {
      if (readSubsRef.current.has(cid)) continue;
      try {
        const sub = client.subscribe(`/topic/chat/${cid}/read`, (m) => {
          const ev = safeJsonParse(m.body);
          if (!ev || !ev.chatId || !ev.readerId || !ev.readAt) return;
          upsertReadReceipt(ev.chatId, ev.readerId, ev.readAt);
        });
        readSubsRef.current.set(cid, sub);
      } catch (e) {}
    }

    return () => {};
  }, [client, connected, state.chatsById, state.activeChatId, upsertReadReceipt]);

  useEffect(() => {
    return () => {
      safeUnsubscribe(wsSubsRef.current.messages);
      safeUnsubscribe(wsSubsRef.current.notifications);
      safeUnsubscribe(wsSubsRef.current.presence);
      safeUnsubscribe(wsSubsRef.current.readReceipts);
      for (const sub of readSubsRef.current.values()) safeUnsubscribe(sub);
      readSubsRef.current.clear();
    };
  }, []);

  const chats = useMemo(() => {
    return state.chatOrder.map((id) => state.chatsById[id]).filter(Boolean);
  }, [state.chatOrder, state.chatsById]);

  const updateFaviconBadge = useCallback((count) => {
    if (typeof window === 'undefined') return;
    try {
      let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/png';
      link.rel = 'shortcut icon';

      if (count > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1e1e23';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(16, 16, 12, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(26, 6, 8, 0, 2 * Math.PI);
        ctx.fill();

        if (count > 0) {
          ctx.fillStyle = 'white';
          ctx.font = 'bold 11px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const text = count > 99 ? '99+' : String(count);
          ctx.fillText(text, 26, 6);
        }

        link.href = canvas.toDataURL();
        if (!document.querySelector("link[rel*='icon']")) {
          document.getElementsByTagName('head')[0].appendChild(link);
        }
      } else {
        link.href = '/favicon.ico';
        if (!document.querySelector("link[rel*='icon']")) {
          document.getElementsByTagName('head')[0].appendChild(link);
        }
      }
    } catch (e) {}
  }, []);

  const totalUnread = useMemo(() => {
    return chats.reduce((sum, chat) => sum + (chat?.unreadCount || 0), 0);
  }, [chats]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const baseTitle = 'Pager';
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) ${baseTitle}`;
      updateFaviconBadge(totalUnread);
    } else {
      document.title = baseTitle;
      updateFaviconBadge(0);
    }
  }, [totalUnread, updateFaviconBadge]);

  const upsertChat = useCallback((chat) => {
    if (!chat?.id) return;
    dispatch({
      type: actionTypes.UPSERT_CHAT,
      payload: { chat },
    });
  }, []);

  const value = useMemo(() => {
    return {
      chats,
      loading: false,
      refreshChats,
      activeChatId: state.activeChatId,
      setActiveChatId,
      markChatAsRead,
      readAtByChatIdByUserId: state.readAtByChatIdByUserId,
      messageIdsByChatId: state.messageIdsByChatId,
      messagesById: state.messagesById,
      upsertReadReceipt,
      setReadReceiptsForChat,
      upsertMessage,
      updateMessage,
      removeMessage,
      addOptimistic,
      replaceOptimistic,
      upsertChat,
    };
  }, [
    chats,
    refreshChats,
    state.activeChatId,
    setActiveChatId,
    markChatAsRead,
    state.readAtByChatIdByUserId,
    state.messageIdsByChatId,
    state.messagesById,
    upsertReadReceipt,
    setReadReceiptsForChat,
    upsertMessage,
    updateMessage,
    removeMessage,
    addOptimistic,
    replaceOptimistic,
    upsertChat,
  ]);

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
};
