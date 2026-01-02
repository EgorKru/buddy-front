import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { chatAPI, getCurrentUser } from '@/utils/api';
import { useStomp } from '@/context/socket';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';

const ChatsContext = createContext(null);

const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getNotificationChatId = (n) => {
  return n?.chatId ?? n?.message?.chatId ?? n?.payload?.chatId ?? null;
};

const getNotificationMessage = (n) => {
  return n?.message ?? n?.payload?.message ?? n;
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
  };
};

export const ChatsProvider = ({ children }) => {
  const { client, connected } = useStomp();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChatId, setActiveChatIdState] = useState(null);
  const [readReceiptsByChatId, setReadReceiptsByChatId] = useState({});
  const subscriptionRef = useRef(null);
  const readSubscriptionsRef = useRef(new Map());
  const lastReadAtRef = useRef(new Map());

  const refreshChats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatAPI.getChats();
      const list = Array.isArray(data) ? data : [];
      setChats(sortChatsByLastActivity(list));
    } catch (e) {
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
      prev.map(c => (String(c.id) === key ? { ...c, unreadCount: 0 } : c))
    );

    try {
      await chatAPI.markChatAsRead(key);
    } catch (e) {}
  }, []);

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

    setChats(prev => {
      const idx = prev.findIndex(c => String(c.id) === String(chatId));
      if (idx === -1) return prev;

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
  }, [activeChatId, markChatAsRead]);

  useEffect(() => {
    if (!client || !connected || !client.connected || !client.active) return;

    if (subscriptionRef.current) {
      safeUnsubscribe(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    try {
      const sub = client.subscribe('/user/queue/messages', (message) => {
        const notification = safeJsonParse(message.body);
        if (!notification) return;
        handleNotification(notification);
      });
      subscriptionRef.current = sub;
    } catch (e) {}

    return () => {
      if (subscriptionRef.current) {
        safeUnsubscribe(subscriptionRef.current);
        subscriptionRef.current = null;
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
    };
  }, [chats, loading, refreshChats, activeChatId, setActiveChatId, markChatAsRead, readReceiptsByChatId]);

  return (
    <ChatsContext.Provider value={value}>
      {children}
    </ChatsContext.Provider>
  );
};


