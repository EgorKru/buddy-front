import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { chatAPI, getCurrentUser, isAuthenticated, getToken } from '@/utils/api';
import { useStomp } from '@/context/socket';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import { playPagerNotificationSound } from '@/utils/pagerSound';

const MessagingContext = createContext(null);

const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const isNewer = (a, b) => {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  return ta > tb;
};

const getNotificationChatId = (n) => {
  return n?.chatId ?? n?.message?.chatId ?? n?.payload?.chatId ?? null;
};

const getNotificationMessage = (n) => {
  return n?.message ?? n?.payload?.message ?? null;
};

const initialState = {
  chatsById: {},
  chatOrder: [],
  messagesById: {},
  messageIdsByChatId: {},
  readAtByChatIdByUserId: {},
  activeChatId: null,
};

const actionTypes = {
  SET_CHATS: 'SET_CHATS',
  UPSERT_CHAT: 'UPSERT_CHAT',
  SET_ACTIVE_CHAT: 'SET_ACTIVE_CHAT',
  UPSERT_MESSAGE: 'UPSERT_MESSAGE',
  ADD_OPTIMISTIC: 'ADD_OPTIMISTIC',
  REPLACE_OPTIMISTIC: 'REPLACE_OPTIMISTIC',
  APPLY_READ_RECEIPT: 'APPLY_READ_RECEIPT',
  MARK_CHAT_READ_LOCAL: 'MARK_CHAT_READ_LOCAL',
};

const ensureArray = (v) => (Array.isArray(v) ? v : []);

const upsertOrder = (order, chatId) => {
  const id = String(chatId);
  const filtered = order.filter(x => String(x) !== id);
  return [id, ...filtered];
};

const reducer = (state, action) => {
  switch (action.type) {
    case actionTypes.SET_CHATS: {
      const list = ensureArray(action.payload?.chats);
      const chatsById = {};
      let chatOrder = [];

      for (const c of list) {
        if (!c?.id) continue;
        const id = String(c.id);
        chatsById[id] = c;
      }

      chatOrder = Object.keys(chatsById).sort((a, b) => {
        const ca = chatsById[a];
        const cb = chatsById[b];
        const ta = toIso(ca?.updatedAt ?? ca?.lastMessage?.createdAt ?? ca?.createdAt);
        const tb = toIso(cb?.updatedAt ?? cb?.lastMessage?.createdAt ?? cb?.createdAt);
        return (tb ? new Date(tb).getTime() : 0) - (ta ? new Date(ta).getTime() : 0);
      });

      return { ...state, chatsById, chatOrder };
    }

    case actionTypes.UPSERT_CHAT: {
      const chat = action.payload?.chat;
      if (!chat?.id) return state;
      const id = String(chat.id);
      const existing = state.chatsById[id] || {};
      const merged = { ...existing, ...chat };
      return {
        ...state,
        chatsById: { ...state.chatsById, [id]: merged },
        chatOrder: upsertOrder(state.chatOrder, id),
      };
    }

    case actionTypes.SET_ACTIVE_CHAT: {
      return { ...state, activeChatId: action.payload?.chatId ? String(action.payload.chatId) : null };
    }

    case actionTypes.UPSERT_MESSAGE: {
      const message = action.payload?.message;
      const chatId = message?.chatId ?? action.payload?.chatId;
      if (!message?.id || !chatId) return state;
      const cid = String(chatId);
      const mid = String(message.id);

      const messagesById = { ...state.messagesById, [mid]: message };
      const existingIds = ensureArray(state.messageIdsByChatId[cid]);
      const has = existingIds.some(x => String(x) === mid);
      const nextIds = has ? existingIds : [...existingIds, mid];
      nextIds.sort((a, b) => {
        const ma = messagesById[String(a)];
        const mb = messagesById[String(b)];
        return new Date(ma?.createdAt).getTime() - new Date(mb?.createdAt).getTime();
      });

      const chatsById = { ...state.chatsById };
      const chat = chatsById[cid];
      if (chat) {
        const last = chat?.lastMessage;
        if (!last?.createdAt || isNewer(message.createdAt, last.createdAt)) {
          chatsById[cid] = {
            ...chat,
            lastMessage: message,
            updatedAt: toIso(message.createdAt) || chat.updatedAt,
            unreadCount: action.payload?.unreadDelta != null
              ? Math.max(0, Number(chat.unreadCount || 0) + Number(action.payload.unreadDelta))
              : chat.unreadCount,
          };
        } else if (action.payload?.unreadDelta != null) {
          chatsById[cid] = {
            ...chat,
            unreadCount: Math.max(0, Number(chat.unreadCount || 0) + Number(action.payload.unreadDelta)),
          };
        }
      }

      return {
        ...state,
        messagesById,
        messageIdsByChatId: { ...state.messageIdsByChatId, [cid]: nextIds },
        chatsById,
        chatOrder: upsertOrder(state.chatOrder, cid),
      };
    }

    case actionTypes.ADD_OPTIMISTIC: {
      const { chatId, message } = action.payload || {};
      if (!chatId || !message?.id) return state;
      const cid = String(chatId);
      const mid = String(message.id);
      const messagesById = { ...state.messagesById, [mid]: message };
      const existingIds = ensureArray(state.messageIdsByChatId[cid]);
      const nextIds = existingIds.some(x => String(x) === mid) ? existingIds : [...existingIds, mid];

      const chatsById = { ...state.chatsById };
      const chat = chatsById[cid];
      if (chat) {
        chatsById[cid] = {
          ...chat,
          lastMessage: message,
          updatedAt: toIso(message.createdAt) || chat.updatedAt,
        };
      }

      return {
        ...state,
        messagesById,
        messageIdsByChatId: { ...state.messageIdsByChatId, [cid]: nextIds },
        chatsById,
        chatOrder: upsertOrder(state.chatOrder, cid),
      };
    }

    case actionTypes.REPLACE_OPTIMISTIC: {
      const { chatId, tempId, message, status } = action.payload || {};
      if (!chatId || !tempId || !message?.id) return state;
      const cid = String(chatId);
      const tid = String(tempId);
      const mid = String(message.id);

      const existingIds = ensureArray(state.messageIdsByChatId[cid]);
      const idx = existingIds.findIndex(x => String(x) === tid);
      const idsWithoutTemp = existingIds.filter(x => String(x) !== tid);
      const withReal = idsWithoutTemp.some(x => String(x) === mid)
        ? idsWithoutTemp
        : idx === -1
          ? [...idsWithoutTemp, mid]
          : [...idsWithoutTemp.slice(0, idx), mid, ...idsWithoutTemp.slice(idx)];

      const messagesById = { ...state.messagesById };
      delete messagesById[tid];
      messagesById[mid] = { ...message, status, isOptimistic: false };

      withReal.sort((a, b) => {
        const ma = messagesById[String(a)];
        const mb = messagesById[String(b)];
        return new Date(ma?.createdAt).getTime() - new Date(mb?.createdAt).getTime();
      });

      const chatsById = { ...state.chatsById };
      const chat = chatsById[cid];
      if (chat?.lastMessage?.id && String(chat.lastMessage.id) === tid) {
        chatsById[cid] = { ...chat, lastMessage: messagesById[mid] };
      }

      return {
        ...state,
        messagesById,
        messageIdsByChatId: { ...state.messageIdsByChatId, [cid]: withReal },
        chatsById,
      };
    }

    case actionTypes.APPLY_READ_RECEIPT: {
      const { chatId, readerId, readAt } = action.payload || {};
      if (!chatId || !readerId || !readAt) return state;
      const cid = String(chatId);
      const rid = String(readerId);
      const iso = toIso(readAt);
      if (!iso) return state;
      const current = state.readAtByChatIdByUserId[cid]?.[rid];
      if (current && !isNewer(iso, current)) return state;
      return {
        ...state,
        readAtByChatIdByUserId: {
          ...state.readAtByChatIdByUserId,
          [cid]: {
            ...(state.readAtByChatIdByUserId[cid] || {}),
            [rid]: iso,
          },
        },
      };
    }

    case actionTypes.MARK_CHAT_READ_LOCAL: {
      const cid = action.payload?.chatId ? String(action.payload.chatId) : null;
      if (!cid) return state;
      const chat = state.chatsById[cid];
      if (!chat) return state;
      return {
        ...state,
        chatsById: {
          ...state.chatsById,
          [cid]: { ...chat, unreadCount: 0 },
        },
      };
    }

    default:
      return state;
  }
};

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
      addOptimistic: () => {},
      replaceOptimistic: () => {},
    };
  }
  return ctx;
};

export const useChatMessages = (chatId) => {
  const { messageIdsByChatId, messagesById } = useChats();
  const cid = chatId ? String(chatId) : null;
  const ids = cid ? ensureArray(messageIdsByChatId[cid]) : [];
  return ids.map(id => messagesById[String(id)]).filter(Boolean);
};

export const MessagingProvider = ({ children }) => {
  const { client, connected } = useStomp();
  const [state, dispatch] = useReducer(reducer, initialState);

  const wsSubsRef = useRef({ messages: null, notifications: null });
  const readSubsRef = useRef(new Map());
  const refreshInFlightRef = useRef(false);
  const lastSoundAtRef = useRef(0);
  const processedMessageIdsRef = useRef(new Set());

  const refreshChats = useCallback(async () => {
    if (!isAuthenticated()) return;
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const data = await chatAPI.getChats();
      dispatch({ type: actionTypes.SET_CHATS, payload: { chats: data } });
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      dispatch({ type: actionTypes.SET_CHATS, payload: { chats: [] } });
      return;
    }
    refreshChats();
  }, [refreshChats]);

  useEffect(() => {
    const interval = setInterval(() => {
      const token = getToken();
      if (token) {
        refreshChats();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [refreshChats]);

  const setActiveChatId = useCallback((chatId) => {
    dispatch({ type: actionTypes.SET_ACTIVE_CHAT, payload: { chatId } });
  }, []);

  const markChatAsRead = useCallback(async (chatId) => {
    if (!chatId) return;
    dispatch({ type: actionTypes.MARK_CHAT_READ_LOCAL, payload: { chatId } });
    try {
      await chatAPI.markChatAsRead(chatId);
    } catch (e) {}
  }, []);

  const upsertReadReceipt = useCallback((chatId, readerId, readAt) => {
    dispatch({ type: actionTypes.APPLY_READ_RECEIPT, payload: { chatId, readerId, readAt } });
  }, []);

  const upsertMessage = useCallback((message, meta = {}) => {
    if (!message?.id || !message?.chatId) return;
    const mid = String(message.id);
    if (processedMessageIdsRef.current.has(mid)) return;
    processedMessageIdsRef.current.add(mid);

    const currentUser = getCurrentUser();
    const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    const active = state.activeChatId && String(state.activeChatId) === String(message.chatId);
    const isOwn = currentUser?.id && message?.senderId && Number(currentUser.id) === Number(message.senderId);
    const unreadDelta = isOwn ? 0 : (active && isVisible ? 0 : 1);

    dispatch({
      type: actionTypes.UPSERT_MESSAGE,
      payload: { message, chatId: message.chatId, unreadDelta: meta.unreadDelta ?? unreadDelta },
    });
  }, [state.activeChatId]);

  const addOptimistic = useCallback((chatId, optimisticMessage) => {
    dispatch({ type: actionTypes.ADD_OPTIMISTIC, payload: { chatId, message: optimisticMessage } });
  }, []);

  const replaceOptimistic = useCallback((chatId, tempId, serverMessage, status) => {
    dispatch({ type: actionTypes.REPLACE_OPTIMISTIC, payload: { chatId, tempId, message: serverMessage, status } });
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
      const isOwn = currentUser?.id && msg?.senderId && Number(currentUser.id) === Number(msg.senderId);
      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      const active = state.activeChatId && String(state.activeChatId) === String(cid);
      if (isOwn) return;
      if (active && isVisible) return;

      const now = Date.now();
      if (now - lastSoundAtRef.current < 500) return;
      lastSoundAtRef.current = now;
      playPagerNotificationSound({ pattern: 'pager' });
    } catch (e) {}
  }, [state.activeChatId]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    if (!client || !connected || !client.connected || !client.active) return;

    const cleanup = () => {
      safeUnsubscribe(wsSubsRef.current.messages);
      safeUnsubscribe(wsSubsRef.current.notifications);
      wsSubsRef.current.messages = null;
      wsSubsRef.current.notifications = null;
    };
    cleanup();

    try {
      wsSubsRef.current.messages = client.subscribe('/user/queue/messages', (m) => {
        const notif = safeJsonParse(m.body);
        if (!notif) return;
        const msg = getNotificationMessage(notif);
        if (msg?.id) upsertMessage(msg);
        maybeSound(notif);
      });
    } catch (e) {}

    try {
      wsSubsRef.current.notifications = client.subscribe('/user/queue/notifications', (m) => {
        const notif = safeJsonParse(m.body);
        if (!notif) return;
        const msg = getNotificationMessage(notif);
        if (msg?.id) upsertMessage(msg);
        maybeSound(notif);
      });
    } catch (e) {}

    return () => cleanup();
  }, [client, connected, upsertMessage, maybeSound]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    if (!client || !connected || !client.connected || !client.active) return;

    const chatIds = new Set(state.chatOrder.map(String));

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
          if (!ev?.chatId || !ev?.readerId || !ev?.readAt) return;
          upsertReadReceipt(ev.chatId, ev.readerId, ev.readAt);
        });
        readSubsRef.current.set(cid, sub);
      } catch (e) {}
    }

    return () => {};
  }, [client, connected, state.chatOrder, upsertReadReceipt]);

  useEffect(() => {
    return () => {
      safeUnsubscribe(wsSubsRef.current.messages);
      safeUnsubscribe(wsSubsRef.current.notifications);
      for (const sub of readSubsRef.current.values()) safeUnsubscribe(sub);
      readSubsRef.current.clear();
    };
  }, []);

  const chats = useMemo(() => state.chatOrder.map(id => state.chatsById[id]).filter(Boolean), [state.chatOrder, state.chatsById]);

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
      upsertMessage,
      addOptimistic,
      replaceOptimistic,
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
    upsertMessage,
    addOptimistic,
    replaceOptimistic,
  ]);

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};


