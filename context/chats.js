import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { chatAPI, getCurrentUser } from '@/utils/api';
import { useStomp } from '@/context/socket';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';
import { playPagerNotificationSound } from '@/utils/pagerSound';

const ChatsContext = createContext(null);

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

const getNotificationChatId = (n) => {
  return n?.chatId ?? n?.message?.chatId ?? n?.payload?.chatId ?? null;
};

const getNotificationMessage = (n) => {
  if (n?.message || n?.payload?.message) return n?.message ?? n?.payload?.message;
  if (n?.content || n?.createdAt) {
    return {
      content: n?.content,
      createdAt: n?.createdAt,
    };
  }
  return n;
};

const sortChatsByLastActivity = (list) => {
  const getTime = (chat) => {
    const t = chat?.updatedAt ?? chat?.lastMessage?.createdAt ?? chat?.createdAt;
    const iso = toIso(t);
    return iso ? new Date(iso).getTime() : 0;
  };

  return [...list].sort((a, b) => getTime(b) - getTime(a));
};

export const useChats = () => {
  const ctx = useContext(ChatsContext);
  return ctx || {
    chats: [],
    loading: false,
    refreshChats: async () => {},
    activeChatId: null,
    setActiveChatId: () => {},
    markChatAsRead: async () => {},
    readReceiptsByChatId: {},
    bumpChatLastMessage: () => {},
    upsertReadReceipt: () => {},
  };
};

export const ChatsProvider = ({ children }) => {
  const { client, connected } = useStomp();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChatId, setActiveChatIdState] = useState(null);
  const [readReceiptsByChatId, setReadReceiptsByChatId] = useState({});
  const subscriptionRef = useRef(null);
  const notificationsSubscriptionRef = useRef(null);
  const readSubscriptionsRef = useRef(new Map());
  const lastReadAtRef = useRef(new Map());
  const lastRefreshAtRef = useRef(0);
  const lastSoundAtRef = useRef(0);
  const processedNotificationMessageIdsRef = useRef(new Set());
  const processedCleanupRef = useRef(null);
  const pendingByChatIdRef = useRef(new Map());
  const pendingCleanupRef = useRef(null);

  const refreshChats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatAPI.getChats();
      const list = Array.isArray(data) ? data : [];
      const currentUser = getCurrentUser();
      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      const activeId = activeChatId ? String(activeChatId) : null;

      const pending = pendingByChatIdRef.current;
      if (pending.size > 0) {
        for (const chat of list) {
          const cid = String(chat?.id);
          const byMessageId = pending.get(cid);
          if (!byMessageId || byMessageId.size === 0) continue;

          const messages = Array.from(byMessageId.values())
            .filter(m => m?.id != null)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

          for (const msg of messages) {
            const messageId = String(msg.id);
            if (processedNotificationMessageIdsRef.current.has(messageId)) continue;

            const isOwn = currentUser?.id && msg?.senderId && Number(currentUser.id) === Number(msg.senderId);
            const isActive = activeId && activeId === cid;
            const unreadInc = isOwn ? 0 : (isActive && isVisible ? 0 : 1);

            chat.lastMessage = { ...(chat.lastMessage || {}), ...msg };
            chat.updatedAt = toIso(msg.createdAt) || chat.updatedAt;
            chat.unreadCount = Math.max(0, Number(chat.unreadCount || 0) + unreadInc);

            processedNotificationMessageIdsRef.current.add(messageId);
          }

          pending.delete(cid);
        }
      }

      setChats(sortChatsByLastActivity(list));
    } catch (e) {
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, [activeChatId]);

  const refreshChatsThrottled = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < 1000) return;
    lastRefreshAtRef.current = now;
    await refreshChats();
  }, [refreshChats]);

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  const setActiveChatId = useCallback((chatId) => {
    setActiveChatIdState(chatId ? String(chatId) : null);
  }, []);

  const markChatAsRead = useCallback(async (chatId) => {
    if (!chatId) return;
    const key = String(chatId);
    const now = Date.now();
    const last = lastReadAtRef.current.get(key) || 0;
    if (now - last < 1000) return;
    lastReadAtRef.current.set(key, now);

    setChats(prev =>
      prev.map(c => {
        if (String(c.id) !== key) return c;
        // Получить lastReadMessageId из lastMessage чата
        const lastReadMessageId = c.lastMessage?.id;
        
        // Отправить через WebSocket если есть lastReadMessageId
        if (client && connected && lastReadMessageId) {
          try {
            client.publish({
              destination: '/app/chat.markRead',
              body: JSON.stringify({
                chatId: parseInt(key),
                lastReadMessageId: parseInt(lastReadMessageId),
              }),
            });
          } catch (e) {
            console.error('Failed to send markRead via WebSocket:', e);
          }
        }
        
        return { ...c, unreadCount: 0 };
      })
    );

    // Fallback на REST API
    try {
      await chatAPI.markChatAsRead(key);
    } catch (e) {}
  }, [client, connected]);

  const upsertReadReceipt = useCallback((chatId, readerId, readAt) => {
    const cid = String(chatId);
    const rid = String(readerId);
    const iso = toIso(readAt);
    if (!cid || !rid || !iso) return;

    setReadReceiptsByChatId(prev => {
      const currentChatMap = prev[cid] || {};
      const existing = currentChatMap[rid];
      if (existing && new Date(existing).getTime() >= new Date(iso).getTime()) {
        return prev;
      }
      return {
        ...prev,
        [cid]: {
          ...currentChatMap,
          [rid]: iso,
        },
      };
    });
  }, []);

  const handleNotification = useCallback((notification) => {
    const chatId = getNotificationChatId(notification);
    if (!chatId) return;

    const message = getNotificationMessage(notification);
    const currentUser = getCurrentUser();
    const isOwnMessage = currentUser?.id && message?.senderId && Number(currentUser.id) === Number(message.senderId);
    const messageId = message?.id != null ? String(message.id) : null;
    const nextLastMessage = {
      ...(message?.id ? { id: message.id } : null),
      ...(message?.senderId ? { senderId: message.senderId } : null),
      ...(message?.senderUsername ? { senderUsername: message.senderUsername } : null),
      ...(message?.senderDisplayName ? { senderDisplayName: message.senderDisplayName } : null),
      ...(message?.content ? { content: message.content } : null),
      ...(message?.type ? { type: message.type } : null),
      ...(toIso(message?.createdAt || notification?.createdAt) ? { createdAt: toIso(message?.createdAt || notification?.createdAt) } : null),
    };

    const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    const isActive = activeChatId && String(activeChatId) === String(chatId);
    const shouldSound = !isOwnMessage && (!isActive || !isVisible);

    setChats(prev => {
      const idx = prev.findIndex(c => String(c.id) === String(chatId));
      if (idx === -1) {
        if (messageId) {
          const cid = String(chatId);
          const byMessageId = pendingByChatIdRef.current.get(cid) || new Map();
          if (!byMessageId.has(messageId) && !processedNotificationMessageIdsRef.current.has(messageId)) {
            byMessageId.set(messageId, {
              id: message?.id,
              chatId: message?.chatId || chatId,
              senderId: message?.senderId,
              senderUsername: message?.senderUsername,
              senderDisplayName: message?.senderDisplayName,
              content: message?.content,
              type: message?.type,
              createdAt: message?.createdAt || notification?.createdAt || new Date().toISOString(),
            });
            pendingByChatIdRef.current.set(cid, byMessageId);
          }
        }
        refreshChatsThrottled();
        return prev;
      }

      if (messageId) {
        if (processedNotificationMessageIdsRef.current.has(messageId)) return prev;
        processedNotificationMessageIdsRef.current.add(messageId);
      }

      const current = prev[idx];
      const unreadInc = isOwnMessage ? 0 : (isActive && isVisible ? 0 : 1);
      const mergedLastMessage = Object.keys(nextLastMessage).length
        ? { ...(current.lastMessage || {}), ...nextLastMessage }
        : current.lastMessage;

      const updatedChat = {
        ...current,
        lastMessage: mergedLastMessage,
        updatedAt: toIso(mergedLastMessage?.createdAt || current.updatedAt || new Date().toISOString()) || current.updatedAt,
        unreadCount: Math.max(0, Number(current.unreadCount || 0) + unreadInc),
      };

      const next = [...prev];
      next.splice(idx, 1);
      next.unshift(updatedChat);
      return next;
    });

    if (isActive && isVisible) {
      markChatAsRead(chatId);
    }

    if (shouldSound) {
      try {
        if (typeof window !== 'undefined') {
          const disabled = localStorage.getItem('disable_notification_sound') === 'true';
          const now = Date.now();
          if (!disabled && now - lastSoundAtRef.current > 500) {
            lastSoundAtRef.current = now;
            playPagerNotificationSound({ pattern: 'pager' });
          }
        }
      } catch (e) {}
    }
  }, [activeChatId, markChatAsRead, refreshChatsThrottled]);

  useEffect(() => {
    processedCleanupRef.current = setInterval(() => {
      if (processedNotificationMessageIdsRef.current.size > 2000) {
        processedNotificationMessageIdsRef.current.clear();
      }
    }, 5 * 60 * 1000);
    return () => {
      if (processedCleanupRef.current) {
        clearInterval(processedCleanupRef.current);
        processedCleanupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    pendingCleanupRef.current = setInterval(() => {
      if (pendingByChatIdRef.current.size > 200) {
        pendingByChatIdRef.current.clear();
      }
    }, 10 * 60 * 1000);
    return () => {
      if (pendingCleanupRef.current) {
        clearInterval(pendingCleanupRef.current);
        pendingCleanupRef.current = null;
      }
    };
  }, []);

  const bumpChatLastMessage = useCallback((chatId, message, currentUserId) => {
    if (!chatId || !message) return;
    const cid = String(chatId);

    const nextLastMessage = {
      ...(message?.id ? { id: message.id } : null),
      ...(message?.senderId ? { senderId: message.senderId } : (currentUserId ? { senderId: currentUserId } : null)),
      ...(message?.senderUsername ? { senderUsername: message.senderUsername } : null),
      ...(message?.senderDisplayName ? { senderDisplayName: message.senderDisplayName } : null),
      ...(message?.content ? { content: message.content } : null),
      ...(message?.type ? { type: message.type } : null),
      ...(toIso(message?.createdAt) ? { createdAt: toIso(message.createdAt) } : { createdAt: new Date().toISOString() }),
    };

    setChats(prev => {
      const idx = prev.findIndex(c => String(c.id) === cid);
      if (idx === -1) {
        refreshChatsThrottled();
        return prev;
      }

      const current = prev[idx];
      const updatedChat = {
        ...current,
        lastMessage: { ...(current.lastMessage || {}), ...nextLastMessage },
        updatedAt: toIso(nextLastMessage.createdAt) || current.updatedAt,
      };

      const next = [...prev];
      next.splice(idx, 1);
      next.unshift(updatedChat);
      return next;
    });
  }, [refreshChatsThrottled]);

  useEffect(() => {
    if (!client || !connected || !client.connected || !client.active) return;

    if (subscriptionRef.current) {
      safeUnsubscribe(subscriptionRef.current);
      subscriptionRef.current = null;
    }
    if (notificationsSubscriptionRef.current) {
      safeUnsubscribe(notificationsSubscriptionRef.current);
      notificationsSubscriptionRef.current = null;
    }

    try {
      const sub = client.subscribe('/user/queue/messages', (message) => {
        const notification = safeJsonParse(message.body);
        if (!notification) return;
        handleNotification(notification);
      });
      subscriptionRef.current = sub;
    } catch (e) {}

    try {
      const sub = client.subscribe('/user/queue/notifications', (message) => {
        const notification = safeJsonParse(message.body);
        if (!notification) return;
        if (!getNotificationChatId(notification)) return;
        handleNotification(notification);
      });
      notificationsSubscriptionRef.current = sub;
    } catch (e) {}

    return () => {
      if (subscriptionRef.current) {
        safeUnsubscribe(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      if (notificationsSubscriptionRef.current) {
        safeUnsubscribe(notificationsSubscriptionRef.current);
        notificationsSubscriptionRef.current = null;
      }
    };
  }, [client, connected, handleNotification]);

  useEffect(() => {
    if (!client || !connected || !client.connected || !client.active) return;

    const nextChatIds = new Set(chats.map(c => String(c.id)));

    for (const [chatId, sub] of readSubscriptionsRef.current.entries()) {
      if (!nextChatIds.has(chatId)) {
        safeUnsubscribe(sub);
        readSubscriptionsRef.current.delete(chatId);
      }
    }

    for (const chatId of nextChatIds) {
      if (readSubscriptionsRef.current.has(chatId)) continue;
      try {
        const sub = client.subscribe(`/topic/chat/${chatId}/read`, (message) => {
          const event = safeJsonParse(message.body);
          if (!event?.chatId || !event?.readerId || !event?.readAt) return;
          upsertReadReceipt(event.chatId, event.readerId, event.readAt);
        });
        readSubscriptionsRef.current.set(chatId, sub);
      } catch (e) {}
    }

    return () => {};
  }, [client, connected, chats, upsertReadReceipt]);

  useEffect(() => {
    return () => {
      for (const sub of readSubscriptionsRef.current.values()) {
        safeUnsubscribe(sub);
      }
      readSubscriptionsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!activeChatId) return;

    const tryMarkRead = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState !== 'visible') return;
      markChatAsRead(activeChatId);
    };

    window.addEventListener('focus', tryMarkRead);
    document.addEventListener('visibilitychange', tryMarkRead);

    return () => {
      window.removeEventListener('focus', tryMarkRead);
      document.removeEventListener('visibilitychange', tryMarkRead);
    };
  }, [activeChatId, markChatAsRead]);

  const value = useMemo(() => {
    return {
      chats,
      loading,
      refreshChats,
      activeChatId,
      setActiveChatId,
      markChatAsRead,
      readReceiptsByChatId,
      bumpChatLastMessage,
      upsertReadReceipt,
    };
  }, [chats, loading, refreshChats, activeChatId, setActiveChatId, markChatAsRead, readReceiptsByChatId, bumpChatLastMessage, upsertReadReceipt]);

  return (
    <ChatsContext.Provider value={value}>
      {children}
    </ChatsContext.Provider>
  );
};

