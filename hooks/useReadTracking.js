import { useEffect, useRef, useCallback } from 'react';
import { useMessaging } from '@/context/messaging';
import { useStomp } from '@/context/socket';
import { getCurrentUser } from '@/utils/api';

const isElementVisible = (element) => {
  const rect = element.getBoundingClientRect();
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
};

export const useReadTracking = (chatId, enabled = true) => {
  const messagingContext = useMessaging();
  const stompContext = useStomp();
  
  if (!messagingContext || !stompContext) {
    return {
      observeMessage: () => {},
      unobserveMessage: () => {},
      handleScroll: () => {},
    };
  }
  
  const { upsertReadReceipt, messagesById } = messagingContext;
  const { client, connected } = stompContext;
  const observerRef = useRef(null);
  const processedRef = useRef(new Set());
  const scrollTimerRef = useRef(null);
  const isVisibleRef = useRef(true);
  
  const sendReadReceipt = useCallback((messageId) => {
    if (!chatId || !messageId || !client || !connected) return false;
    
    const msgId = parseInt(messageId);
    if (isNaN(msgId)) return false;
    
    const key = `${chatId}-${msgId}`;
    if (processedRef.current.has(key)) return false;
    
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return false;
    
    const message = messagesById?.[String(msgId)];
    if (message && currentUser.id === message.senderId) return false;
    
    processedRef.current.add(key);
    
    const now = new Date().toISOString();
    upsertReadReceipt(chatId, currentUser.id, now);
    
    try {
      client.publish({
        destination: '/app/chat.markRead',
        body: JSON.stringify({
          chatId: parseInt(chatId),
          lastReadMessageId: msgId,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }, [chatId, client, connected, upsertReadReceipt, messagesById]);
  
  const markVisibleMessages = useCallback(() => {
    if (!enabled || !chatId || typeof document === 'undefined') return;
    
    processedRef.current.clear();
    
    document.querySelectorAll('[data-message-id]').forEach(element => {
      if (isElementVisible(element)) {
        const messageId = element.getAttribute('data-message-id');
        if (messageId) sendReadReceipt(messageId);
      }
    });
  }, [enabled, chatId, sendReadReceipt]);
  
  const handleScroll = useCallback(() => {
    if (!enabled) return;
    
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }
    
    scrollTimerRef.current = setTimeout(markVisibleMessages, 200);
  }, [enabled, markVisibleMessages]);
  
  const observeMessage = useCallback((element) => {
    if (!element || !observerRef.current) return;
    
    observerRef.current.observe(element);
    
    if (isElementVisible(element) && isVisibleRef.current) {
      const messageId = element.getAttribute('data-message-id');
      if (messageId) {
        requestAnimationFrame(() => sendReadReceipt(messageId));
      }
    }
  }, [sendReadReceipt]);
  
  const unobserveMessage = useCallback((element) => {
    if (element && observerRef.current) {
      observerRef.current.unobserve(element);
    }
  }, []);
  
  useEffect(() => {
    if (!enabled || !chatId) return;
    
    isVisibleRef.current = typeof document !== 'undefined' ? 
      document.visibilityState === 'visible' : true;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && isVisibleRef.current) {
            const messageId = entry.target.getAttribute('data-message-id');
            if (messageId) sendReadReceipt(messageId);
          }
        });
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: [0, 0.01, 0.1],
      }
    );
    
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
      if (isVisibleRef.current) {
        setTimeout(markVisibleMessages, 100);
      }
    };
    
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(markVisibleMessages, 100);
      }
    };
    
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
    }
    
    if (isVisibleRef.current) {
      setTimeout(markVisibleMessages, 300);
    }
    
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      }
      
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      
      processedRef.current.clear();
    };
  }, [enabled, chatId, sendReadReceipt, markVisibleMessages]);
  
  return {
    observeMessage,
    unobserveMessage,
    handleScroll,
  };
};
