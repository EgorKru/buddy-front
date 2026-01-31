import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { chatAPI, getCurrentUser, isAuthenticated, getToken } from '@/utils/api';
import { useStomp } from '@/context/socket';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import { playPagerNotificationSound } from '@/utils/pagerSound';

const MessagingContext = createContext(null);

const parseServerDate = (dateString) => {
  if (!dateString) return null;
  
  if (typeof dateString === 'number') {
    return new Date(dateString);
  }
  
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // Если это массив (Java LocalDateTime) - УСТАРЕЛО после перехода на UTC
  // Оставлено для обратной совместимости
  if (Array.isArray(dateString) && dateString.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nanosecond = 0] = dateString;
    const millisecond = Math.floor(nanosecond / 1000000);
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  }
  
  let str = String(dateString).trim();
  
  if (/^\d+$/.test(str)) {
    const timestamp = parseInt(str, 10);
    if (timestamp > 1000000000000) {
      return new Date(timestamp);
    }
    if (timestamp > 1000000000) {
      return new Date(timestamp * 1000);
    }
  }
  
  // Бэкенд отправляет ISO с Z суффиксом (UTC)
  return new Date(str);
};

const toIso = (value) => {
  if (!value) return null;
  const date = parseServerDate(value);
  return (date && !Number.isNaN(date.getTime())) ? date.toISOString() : null;
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

const loadReadReceiptsFromStorage = () => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('readReceipts');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
  }
  return {};
};

const initialState = {
  chatsById: {},
  chatOrder: [],
  messagesById: {},
  messageIdsByChatId: {},
  readAtByChatIdByUserId: loadReadReceiptsFromStorage(),
  activeChatId: null,
};

const actionTypes = {
  SET_CHATS: 'SET_CHATS',
  UPSERT_CHAT: 'UPSERT_CHAT',
  SET_ACTIVE_CHAT: 'SET_ACTIVE_CHAT',
  UPSERT_MESSAGE: 'UPSERT_MESSAGE',
  REMOVE_MESSAGE: 'REMOVE_MESSAGE',
  ADD_OPTIMISTIC: 'ADD_OPTIMISTIC',
  REPLACE_OPTIMISTIC: 'REPLACE_OPTIMISTIC',
  APPLY_READ_RECEIPT: 'APPLY_READ_RECEIPT',
  SET_READ_RECEIPTS_FOR_CHAT: 'SET_READ_RECEIPTS_FOR_CHAT',
  MARK_CHAT_READ_LOCAL: 'MARK_CHAT_READ_LOCAL',
  UPDATE_PRESENCE: 'UPDATE_PRESENCE',
};

const ensureArray = (v) => (Array.isArray(v) ? v : []);

const upsertOrder = (order, chatId) => {
  const id = String(chatId);
  const filtered = order.filter(x => String(x) !== id);
  return [id, ...filtered];
};

export const getChatTime = (chat) => {
  const updatedAt = chat?.updatedAt;
  const lastMessageTime = chat?.lastMessage?.createdAt;
  const createdAt = chat?.createdAt;
  
  let time = null;
  
  if (updatedAt && lastMessageTime) {
    const updatedDate = parseServerDate(updatedAt);
    const lastMsgDate = parseServerDate(lastMessageTime);
    const updatedTime = updatedDate ? updatedDate.getTime() : 0;
    const lastMsgTime = lastMsgDate ? lastMsgDate.getTime() : 0;
    time = updatedTime > lastMsgTime ? updatedAt : lastMessageTime;
  } else if (lastMessageTime) {
    time = lastMessageTime;
  } else if (updatedAt) {
    time = updatedAt;
  } else if (createdAt) {
    time = createdAt;
  }
  
  if (!time) return 0;
  try {
    const date = parseServerDate(time);
    const timestamp = date ? date.getTime() : 0;
    if (isNaN(timestamp)) return 0;
    return timestamp;
  } catch {
    return 0;
  }
};

const sortChatsByTime = (chatsById) => {
  return Object.keys(chatsById).sort((a, b) => {
    const timeA = getChatTime(chatsById[a]);
    const timeB = getChatTime(chatsById[b]);
    return timeB - timeA;
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
        const existingChat = state.chatsById[id];
        
        const newLastMessageValid = c.lastMessage && 
                                   c.lastMessage.id && 
                                   c.lastMessage.createdAt;
        
        const normalizedChat = {
          ...c,
          updatedAt: c.updatedAt ?? c.lastMessage?.createdAt ?? c.createdAt,
          lastMessage: newLastMessageValid ? c.lastMessage : (existingChat?.lastMessage || null),
        };
        chatsById[id] = normalizedChat;
      }

      const chatOrder = sortChatsByTime(chatsById);

      return { ...state, chatsById, chatOrder };
    }

    case actionTypes.UPSERT_CHAT: {
      const chat = action.payload?.chat;
      if (!chat?.id) return state;
      const id = String(chat.id);
      const existing = state.chatsById[id] || {};
      
      const newLastMessageValid = chat.lastMessage && 
                                  chat.lastMessage.id && 
                                  chat.lastMessage.createdAt;
      
      const merged = { 
        ...existing, 
        ...chat,
        lastMessage: newLastMessageValid ? chat.lastMessage : (existing.lastMessage || null),
        updatedAt: chat.updatedAt || existing.updatedAt || null,
      };
      const updatedChatsById = { ...state.chatsById, [id]: merged };
      
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

      const existingMessage = state.messagesById[mid];
      const mergedMessage = existingMessage ? { ...existingMessage, ...message } : message;
      const messagesById = { ...state.messagesById, [mid]: mergedMessage };
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
          const newUnreadCount = shouldResetUnread 
            ? 0 
            : Math.max(0, Number(chat.unreadCount || 0) + Number(action.payload.unreadDelta));
          
          chatsById[cid] = {
            ...chat,
            unreadCount: newUnreadCount,
          };
        } else if (shouldResetUnread && chat.unreadCount > 0) {
          chatsById[cid] = {
            ...chat,
            unreadCount: 0,
          };
        }
      }

      const currentChatOrder = state.chatOrder;
      const currentFirstChatId = currentChatOrder[0];
      const chatTime = getChatTime(chatsById[cid]);
      const firstChatTime = currentFirstChatId ? getChatTime(chatsById[currentFirstChatId]) : 0;
      
      let chatOrder = currentChatOrder;
      if (String(currentFirstChatId) !== cid && chatTime > firstChatTime) {
        chatOrder = sortChatsByTime(chatsById);
      } else if (String(currentFirstChatId) === cid) {
        chatOrder = currentChatOrder;
      }

      return {
        ...state,
        messagesById,
        messageIdsByChatId: { ...state.messageIdsByChatId, [cid]: nextIds },
        chatsById,
        chatOrder,
      };
    }

    case actionTypes.REMOVE_MESSAGE: {
      const messageId = action.payload?.messageId;
      const chatId = action.payload?.chatId;
      if (!messageId || !chatId) return state;
      const cid = String(chatId);
      const mid = String(messageId);

      const existingIds = ensureArray(state.messageIdsByChatId[cid]);
      const nextIds = existingIds.filter(id => String(id) !== mid);
      const messageIdsByChatId = { ...state.messageIdsByChatId, [cid]: nextIds };

      const messagesById = { ...state.messagesById };
      const existingMessage = messagesById[mid];
      if (existingMessage) {
        messagesById[mid] = {
          ...existingMessage,
          deletedForMe: action.payload.deletedForMe ?? existingMessage.deletedForMe,
          deletedForAll: action.payload.deletedForAll ?? existingMessage.deletedForAll,
        };
      }

      return { ...state, messagesById, messageIdsByChatId };
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
      const optimisticMsg = messagesById[tid];
      delete messagesById[tid];
      
      const finalMessage = { ...message, status, isOptimistic: false };
      if (optimisticMsg) {
        if (!finalMessage.fileSize && optimisticMsg.fileSize) {
          finalMessage.fileSize = optimisticMsg.fileSize;
        }
        if (!finalMessage.mimeType && optimisticMsg.mimeType) {
          finalMessage.mimeType = optimisticMsg.mimeType;
        }
        if (!finalMessage.fileName && optimisticMsg.fileName) {
          finalMessage.fileName = optimisticMsg.fileName;
        }
      }
      messagesById[mid] = finalMessage;

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

      const currentChatOrder = state.chatOrder;
      const currentFirstChatId = currentChatOrder[0];
      const chatTime = getChatTime(chatsById[cid]);
      const firstChatTime = currentFirstChatId ? getChatTime(chatsById[currentFirstChatId]) : 0;
      
      let chatOrder = currentChatOrder;
      if (String(currentFirstChatId) !== cid && chatTime > firstChatTime) {
        chatOrder = sortChatsByTime(chatsById);
      } else if (String(currentFirstChatId) === cid) {
        chatOrder = currentChatOrder;
      }

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
      
      const newReadAtByChatIdByUserId = {
        ...state.readAtByChatIdByUserId,
        [cid]: {
          ...(state.readAtByChatIdByUserId[cid] || {}),
          [rid]: iso,
        },
      };
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('readReceipts', JSON.stringify(newReadAtByChatIdByUserId));
        } catch (e) {
        }
      }
      
      return {
        ...state,
        readAtByChatIdByUserId: newReadAtByChatIdByUserId,
      };
    }

    case actionTypes.SET_READ_RECEIPTS_FOR_CHAT: {
      const { chatId, readReceipts } = action.payload || {};
      if (!chatId || !readReceipts) return state;
      const cid = String(chatId);
      const newReadAtByChatIdByUserId = {
        ...state.readAtByChatIdByUserId,
        [cid]: {},
      };
      
      for (const [readerId, readAt] of Object.entries(readReceipts)) {
        if (!readerId || !readAt) continue;
        const rid = String(readerId);
        const iso = toIso(readAt);
        if (!iso) continue;
        const current = newReadAtByChatIdByUserId[cid]?.[rid];
        if (!current || isNewer(iso, current)) {
          newReadAtByChatIdByUserId[cid][rid] = iso;
        }
      }
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('readReceipts', JSON.stringify(newReadAtByChatIdByUserId));
        } catch (e) {}
      }
      
      return {
        ...state,
        readAtByChatIdByUserId: newReadAtByChatIdByUserId,
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
  return useMemo(() => {
    const ids = cid ? ensureArray(messageIdsByChatId[cid]) : [];
    return ids.map(id => messagesById[String(id)]).filter(Boolean);
  }, [cid, messageIdsByChatId, messagesById]);
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
                  payload: { chatId: chat.id, readReceipts } 
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

  const markChatAsRead = useCallback(async (chatId) => {
    if (!chatId) return;
    const currentUser = getCurrentUser();
    const cid = String(chatId);
    
    // Получить ID последнего сообщения в чате
    const messageIds = state.messageIdsByChatId[cid] || [];
    const lastReadMessageId = messageIds.length > 0 ? messageIds[messageIds.length - 1] : null;
    
    // Отправить через WebSocket (согласно документации)
    if (client && connected && lastReadMessageId) {
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
    
    // Локально обновить read receipt
    if (currentUser?.id) {
      const now = new Date().toISOString();
      dispatch({ 
        type: actionTypes.APPLY_READ_RECEIPT, 
        payload: { chatId, readerId: currentUser.id, readAt: now } 
      });
    }
    
    dispatch({ type: actionTypes.MARK_CHAT_READ_LOCAL, payload: { chatId } });
    
    // Также отправить через REST API как fallback
    try {
      await chatAPI.markChatAsRead(chatId);
    } catch (e) {}
  }, [client, connected, state.messageIdsByChatId]);

  const upsertReadReceipt = useCallback((chatId, readerId, readAt) => {
    dispatch({ type: actionTypes.APPLY_READ_RECEIPT, payload: { chatId, readerId, readAt } });
  }, []);

  const setReadReceiptsForChat = useCallback((chatId, readReceipts) => {
    dispatch({ type: actionTypes.SET_READ_RECEIPTS_FOR_CHAT, payload: { chatId, readReceipts } });
  }, []);

  const upsertMessage = useCallback((message, meta = {}) => {
    if (!message?.id || !message?.chatId) return;
    const mid = String(message.id);
    if (processedMessageIdsRef.current.has(mid)) return;
    
    const currentUser = getCurrentUser();
    const isOwn = currentUser?.id && message?.senderId && Number(currentUser.id) === Number(message.senderId);
    
    if (isOwn) {
      const cid = String(message.chatId);
      const existingIds = ensureArray(state.messageIdsByChatId[cid]);
      const existingMessages = existingIds
        .map(id => state.messagesById[String(id)])
        .filter(Boolean);

      const isDuplicate = existingMessages.some(existing => {
        if (!existing || !existing.id) return false;
        if (String(existing.id) === mid) return true;
        return false;
      });
      
      if (isDuplicate) {
        processedMessageIdsRef.current.add(mid);
        return;
      }
    }
    
    processedMessageIdsRef.current.add(mid);

    const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    const active = state.activeChatId && String(state.activeChatId) === String(message.chatId);
    const unreadDelta = isOwn ? 0 : (active && isVisible ? 0 : 1);

    dispatch({
      type: actionTypes.UPSERT_MESSAGE,
      payload: { message, chatId: message.chatId, unreadDelta: meta.unreadDelta ?? unreadDelta },
    });
    
    // МОМЕНТАЛЬНАЯ ОТМЕТКА: если сообщение пришло в активный видимый чат - помечаем прочитанным СРАЗУ
    if (!isOwn && active && isVisible && client && connected) {
      console.log('[MESSAGING] Auto-marking new message as read (active+visible):', {
        chatId: message.chatId,
        messageId: message.id,
        userId: currentUser?.id
      });
      
      // Небольшая задержка чтобы сообщение успело отрендериться
      setTimeout(() => {
        try {
          // Локально обновляем read receipt
          const now = new Date().toISOString();
          dispatch({ 
            type: actionTypes.APPLY_READ_RECEIPT, 
            payload: { 
              chatId: message.chatId, 
              readerId: currentUser.id, 
              readAt: now 
            } 
          });
          
          // Отправляем на сервер
          client.publish({
            destination: '/app/chat.markRead',
            body: JSON.stringify({
              chatId: parseInt(message.chatId),
              lastReadMessageId: parseInt(message.id),
            }),
          });
          
          console.log('[MESSAGING] Sent instant read receipt:', {
            chatId: message.chatId,
            messageId: message.id
          });
        } catch (error) {
          console.error('[MESSAGING] Failed to send instant read receipt:', error);
        }
      }, 50);
    }
  }, [state.activeChatId, state.messageIdsByChatId, state.messagesById, client, connected]);

  const updateMessage = useCallback((message, meta = {}) => {
    if (!message?.id || !message?.chatId) return;
    const mid = String(message.id);
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

  const removeMessage = useCallback((chatId, messageId, deletedForMe = false, deletedForAll = false) => {
    if (!chatId || !messageId) return;
    dispatch({
      type: actionTypes.REMOVE_MESSAGE,
      payload: { chatId, messageId, deletedForMe, deletedForAll },
    });
  }, []);

  const addOptimistic = useCallback((chatId, optimisticMessage) => {
    dispatch({ type: actionTypes.ADD_OPTIMISTIC, payload: { chatId, message: optimisticMessage } });
  }, []);

  const replaceOptimistic = useCallback((chatId, tempId, serverMessage, status) => {
    if (serverMessage?.id) {
      const mid = String(serverMessage.id);
      processedMessageIdsRef.current.add(mid);
    }
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
    } catch (e) {    }
  }, [state.activeChatId]);

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
    if (state.activeChatId) {
      chatIds.add(String(state.activeChatId));
    }

    // Отписываемся от чатов, которых больше нет
    for (const [cid, sub] of readSubsRef.current.entries()) {
      if (!chatIds.has(cid)) {
        safeUnsubscribe(sub);
        readSubsRef.current.delete(cid);
      }
    }

    // Подписываемся на новые чаты
    for (const cid of chatIds) {
      if (readSubsRef.current.has(cid)) continue;
      try {
        const sub = client.subscribe(`/topic/chat/${cid}/read`, (m) => {
          const ev = safeJsonParse(m.body);
          if (!ev || !ev.chatId || !ev.readerId || !ev.readAt) {
            console.warn('[READ RECEIPTS] Invalid read receipt event:', ev);
            return;
          }
          
          console.log('[READ RECEIPTS] Received read receipt:', {
            chatId: ev.chatId,
            readerId: ev.readerId,
            readAt: ev.readAt,
            timestamp: new Date().toISOString()
          });
          
          // МОМЕНТАЛЬНО обновляем локальное состояние
          upsertReadReceipt(ev.chatId, ev.readerId, ev.readAt);
        });
        readSubsRef.current.set(cid, sub);
        console.log('[READ RECEIPTS] Subscribed to chat:', cid);
      } catch (e) {
        console.error('[READ RECEIPTS] Failed to subscribe to chat:', cid, e);
      }
    }

    return () => {};
  }, [client, connected, state.chatOrder, state.activeChatId, upsertReadReceipt]);

  useEffect(() => {
    return () => {
      safeUnsubscribe(wsSubsRef.current.messages);
      safeUnsubscribe(wsSubsRef.current.notifications);
      safeUnsubscribe(wsSubsRef.current.presence);
      for (const sub of readSubsRef.current.values()) safeUnsubscribe(sub);
      readSubsRef.current.clear();
    };
  }, []);

  const chats = useMemo(() => {
    return state.chatOrder.map(id => state.chatsById[id]).filter(Boolean);
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

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};

