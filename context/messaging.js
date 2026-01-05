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
  UPDATE_PRESENCE: 'UPDATE_PRESENCE',
};

const ensureArray = (v) => (Array.isArray(v) ? v : []);

const upsertOrder = (order, chatId) => {
  const id = String(chatId);
  const filtered = order.filter(x => String(x) !== id);
  return [id, ...filtered];
};

// Функция для получения времени последнего сообщения чата
// Экспортируем для использования в компонентах
export const getChatTime = (chat) => {
  // Используем максимальное время из updatedAt и lastMessage.createdAt
  // Это нужно, потому что бэкенд может не обновлять updatedAt при новых сообщениях
  const updatedAt = chat?.updatedAt;
  const lastMessageTime = chat?.lastMessage?.createdAt;
  const createdAt = chat?.createdAt;
  
  let time = null;
  
  if (updatedAt && lastMessageTime) {
    // Если есть оба, берем более новое
    const updatedDate = new Date(updatedAt);
    const lastMsgDate = new Date(lastMessageTime);
    time = updatedDate.getTime() > lastMsgDate.getTime() ? updatedAt : lastMessageTime;
  } else if (lastMessageTime) {
    time = lastMessageTime;
  } else if (updatedAt) {
    time = updatedAt;
  } else if (createdAt) {
    time = createdAt;
  }
  
  if (!time) return 0;
  try {
    const date = new Date(time);
    const timestamp = date.getTime();
    if (isNaN(timestamp)) return 0;
    return timestamp;
  } catch {
    return 0;
  }
};

// Функция для сортировки чатов по времени последнего сообщения (более новые выше)
const sortChatsByTime = (chatsById) => {
  return Object.keys(chatsById).sort((a, b) => {
    const timeA = getChatTime(chatsById[a]);
    const timeB = getChatTime(chatsById[b]);
    return timeB - timeA; // Более новые (большее время) идут первыми
  });
};

const reducer = (state, action) => {
  switch (action.type) {
    case actionTypes.SET_CHATS: {
      const list = ensureArray(action.payload?.chats);
      const chatsById = {};

      for (const c of list) {
        if (!c?.id) continue;
        const id = String(c.id);
        // Нормализуем данные чата, убеждаясь что есть поля для сортировки
        const normalizedChat = {
          ...c,
          // Если есть lastMessage, но нет updatedAt, используем время последнего сообщения
          updatedAt: c.updatedAt ?? c.lastMessage?.createdAt ?? c.createdAt,
        };
        chatsById[id] = normalizedChat;
      }

      // Всегда сортируем чаты по времени последнего сообщения при загрузке
      const chatOrder = sortChatsByTime(chatsById);

      return { ...state, chatsById, chatOrder };
    }

    case actionTypes.UPSERT_CHAT: {
      const chat = action.payload?.chat;
      if (!chat?.id) return state;
      const id = String(chat.id);
      const existing = state.chatsById[id] || {};
      const merged = { ...existing, ...chat };
      const updatedChatsById = { ...state.chatsById, [id]: merged };
      
      // Пересортировываем весь список чатов по времени последнего сообщения
      const chatOrder = sortChatsByTime(updatedChatsById);
      
      return {
        ...state,
        chatsById: updatedChatsById,
        chatOrder,
      };
    }

    case actionTypes.SET_ACTIVE_CHAT: {
      const newActiveChatId = action.payload?.chatId ? String(action.payload.chatId) : null;
      const chatsById = { ...state.chatsById };
      
      // Сбрасываем счетчик непрочитанных для нового активного чата
      if (newActiveChatId && chatsById[newActiveChatId]) {
        chatsById[newActiveChatId] = {
          ...chatsById[newActiveChatId],
          unreadCount: 0,
        };
      }
      
      return { 
        ...state, 
        activeChatId: newActiveChatId,
        chatsById,
      };
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
      const isActiveChat = state.activeChatId && String(state.activeChatId) === cid;
      const isVisible = typeof window !== 'undefined' && document.visibilityState === 'visible';
      const shouldResetUnread = isActiveChat && isVisible;
      
      if (chat) {
        const last = chat?.lastMessage;
        const isLastMessage = last?.id && String(last.id) === mid;
        if (!last?.createdAt || isNewer(message.createdAt, last.createdAt) || isLastMessage) {
          // Если чат активен и окно видимо, сбрасываем счетчик непрочитанных
          const newUnreadCount = shouldResetUnread 
            ? 0 
            : (action.payload?.unreadDelta != null
              ? Math.max(0, Number(chat.unreadCount || 0) + Number(action.payload.unreadDelta))
              : chat.unreadCount);
          
          chatsById[cid] = {
            ...chat,
            lastMessage: message,
            updatedAt: toIso(message.createdAt) ?? chat.updatedAt ?? new Date().toISOString(),
            unreadCount: newUnreadCount,
          };
        } else if (action.payload?.unreadDelta != null) {
          // Если чат активен и окно видимо, сбрасываем счетчик непрочитанных
          const newUnreadCount = shouldResetUnread 
            ? 0 
            : Math.max(0, Number(chat.unreadCount || 0) + Number(action.payload.unreadDelta));
          
          chatsById[cid] = {
            ...chat,
            unreadCount: newUnreadCount,
          };
        } else if (shouldResetUnread && chat.unreadCount > 0) {
          // Сбрасываем счетчик, если чат активен и окно видимо
          chatsById[cid] = {
            ...chat,
            unreadCount: 0,
          };
        }
      }

      // Пересортировываем весь список чатов по времени последнего сообщения
      // Пересортировываем весь список чатов по времени последнего сообщения
      const chatOrder = sortChatsByTime(chatsById);

      return {
        ...state,
        messagesById,
        messageIdsByChatId: { ...state.messageIdsByChatId, [cid]: nextIds },
        chatsById,
        chatOrder,
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
          updatedAt: toIso(message.createdAt) ?? chat.updatedAt ?? new Date().toISOString(),
        };
      }

      // Пересортировываем весь список чатов по времени последнего сообщения
      const chatOrder = sortChatsByTime(chatsById);

      return {
        ...state,
        messagesById,
        messageIdsByChatId: { ...state.messageIdsByChatId, [cid]: nextIds },
        chatsById,
        chatOrder,
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
        chatsById[cid] = { 
          ...chat, 
          lastMessage: messagesById[mid],
          updatedAt: toIso(messagesById[mid]?.createdAt) ?? chat.updatedAt ?? new Date().toISOString(),
        };
      }

      // Пересортировываем весь список чатов по времени последнего сообщения
      const chatOrder = sortChatsByTime(chatsById);

      return {
        ...state,
        messagesById,
        messageIdsByChatId: { ...state.messageIdsByChatId, [cid]: withReal },
        chatsById,
        chatOrder,
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

    case actionTypes.UPDATE_PRESENCE: {
      const { userId, online, lastSeenAt } = action.payload || {};
      if (!userId) return state;
      const uid = String(userId);
      const chatsById = { ...state.chatsById };
      let updated = false;

      for (const [cid, chat] of Object.entries(chatsById)) {
        if (!chat?.participants) continue;
        const participants = chat.participants.map(p => {
          if (String(p.id) !== uid) return p;
          return {
            ...p,
            online: online ?? p.online,
            lastSeenAt: lastSeenAt ?? p.lastSeenAt,
          };
        });
        if (participants.some((p, i) => p.online !== chat.participants[i]?.online || p.lastSeenAt !== chat.participants[i]?.lastSeenAt)) {
          chatsById[cid] = { ...chat, participants };
          updated = true;
        }
      }

      return updated ? { ...state, chatsById } : state;
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
  const ids = cid ? ensureArray(messageIdsByChatId[cid]) : [];
  return ids.map(id => messagesById[String(id)]).filter(Boolean);
};

export const MessagingProvider = ({ children }) => {
  const { client, connected } = useStomp();
  const [state, dispatch] = useReducer(reducer, initialState);

  const wsSubsRef = useRef({ messages: null, notifications: null, presence: null });
  const readSubsRef = useRef(new Map());
  const refreshInFlightRef = useRef(false);
  const lastSoundAtRef = useRef(0);
  const processedMessageIdsRef = useRef(new Set());
  const lastTokenRef = useRef(null);

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
    const handleAuthMaybeChanged = () => {
      const token = getToken();
      if (!token) {
        lastTokenRef.current = null;
        dispatch({ type: actionTypes.SET_CHATS, payload: { chats: [] } });
        return;
      }
      if (lastTokenRef.current !== token) {
        lastTokenRef.current = token;
        refreshChats();
      }
    };

    handleAuthMaybeChanged();

    const onStorage = (e) => {
      if (e?.key === 'token') {
        handleAuthMaybeChanged();
      }
    };

    const onFocus = () => handleAuthMaybeChanged();
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
  }, [refreshChats]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    if (connected) {
      refreshChats();
    }
  }, [connected, refreshChats]);

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

  const updateMessage = useCallback((message, meta = {}) => {
    if (!message?.id || !message?.chatId) return;
    const mid = String(message.id);
    // Для обновления существующих сообщений очищаем из processedMessageIdsRef
    processedMessageIdsRef.current.delete(mid);

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
      if (isOwn) return;

      const active = state.activeChatId && String(state.activeChatId) === String(cid);
      if (active) return;

      const now = Date.now();
      if (now - lastSoundAtRef.current < 500) return;
      lastSoundAtRef.current = now;
      playPagerNotificationSound({ pattern: 'pager' });
    } catch (e) {}
  }, [state.activeChatId]);

  // Эффект для автоматического сброса счетчика непрочитанных в активном чате
  useEffect(() => {
    if (!state.activeChatId) return;
    const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    if (!isVisible) return;

    const activeChat = state.chatsById[String(state.activeChatId)];
    if (activeChat && activeChat.unreadCount > 0) {
      dispatch({ type: actionTypes.MARK_CHAT_READ_LOCAL, payload: { chatId: state.activeChatId } });
      markChatAsRead(state.activeChatId);
    }
  }, [state.activeChatId, state.chatsById, markChatAsRead]);

  // Эффект для сброса счетчика при изменении видимости окна
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleVisibilityChange = () => {
      if (!state.activeChatId) return;
      const isVisible = document.visibilityState === 'visible';
      if (isVisible) {
        const activeChat = state.chatsById[String(state.activeChatId)];
        if (activeChat && activeChat.unreadCount > 0) {
          dispatch({ type: actionTypes.MARK_CHAT_READ_LOCAL, payload: { chatId: state.activeChatId } });
          markChatAsRead(state.activeChatId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.activeChatId, state.chatsById, markChatAsRead]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    if (!client || !connected || !client.connected || !client.active) return;

    const cleanup = () => {
      safeUnsubscribe(wsSubsRef.current.messages);
      safeUnsubscribe(wsSubsRef.current.notifications);
      safeUnsubscribe(wsSubsRef.current.presence);
      wsSubsRef.current.messages = null;
      wsSubsRef.current.notifications = null;
      wsSubsRef.current.presence = null;
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
            lastSeenAt: event.lastSeenAt,
          },
        });
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
      safeUnsubscribe(wsSubsRef.current.presence);
      for (const sub of readSubsRef.current.values()) safeUnsubscribe(sub);
      readSubsRef.current.clear();
    };
  }, []);

  // Возвращаем чаты в порядке chatOrder, который уже отсортирован по времени последнего сообщения
  const chats = useMemo(() => {
    const ordered = state.chatOrder.map(id => state.chatsById[id]).filter(Boolean);
    // Дополнительная сортировка на случай, если chatOrder не обновился
    return ordered.sort((a, b) => {
      const timeA = getChatTime(a);
      const timeB = getChatTime(b);
      return timeB - timeA; // Более новые выше
    });
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
      updateMessage,
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
    updateMessage,
    addOptimistic,
    replaceOptimistic,
  ]);

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};


