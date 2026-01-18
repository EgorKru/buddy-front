import { useState, useRef, useCallback, useEffect } from 'react';
import { chatAPI, getCurrentUser } from '@/utils/api';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { saveFileMetadata } from '../utils/messageHelpers';
import { INITIAL_MESSAGES_LIMIT, OLDER_MESSAGES_LIMIT } from '../constants/chat';

export const useChatMessages = ({
  chatId,
  upsertMessage,
  refreshChats,
  localPtsRef,
  localSeqRef,
  setReadReceiptsForChat
}) => {
  
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [oldestMessageId, setOldestMessageId] = useState(null);
  const [page, setPage] = useState(0);
  
  const abortControllerRef = useRef(null);
  const isLoadingInitialRef = useRef(false);
  const loadingMessagesRef = useRef(false);
  const lastLoadedMessageIdRef = useRef(null);
  const pendingReadReceiptsRef = useRef(null);

  const loadChatStateFull = useCallback(async (chatId) => {
    if (!chatId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {

      isLoadingInitialRef.current = true;
      
      const state = await chatAPI.getChatStateFull(chatId, INITIAL_MESSAGES_LIMIT);
      
      if (state) {
        if (state.chat) {
          refreshChats();
        }

        if (state.messages && Array.isArray(state.messages)) {
          const ordered = [...state.messages].reverse();
          for (const m of ordered) {
            saveFileMetadata(m);
            upsertMessage(
              { ...m, status: MESSAGE_STATUS.SENT, isOptimistic: false },
              { unreadDelta: 0 }
            );
          }
        }

        const readReceipts = {};
        
        if (state.readReceipts && typeof state.readReceipts === 'object') {
          for (const [userId, lastReadAt] of Object.entries(state.readReceipts)) {
            if (userId && lastReadAt != null) {
              readReceipts[String(userId)] = lastReadAt;
            }
          }
        }
        
        if (state.lastReadAt) {
          const currentUser = getCurrentUser();
          if (currentUser?.id) {
            const currentUserId = String(currentUser.id);
            if (!readReceipts[currentUserId] || state.lastReadAt > readReceipts[currentUserId]) {
              readReceipts[currentUserId] = state.lastReadAt;
            }
          }
        }
        
        if (Object.keys(readReceipts).length > 0) {
          if (setReadReceiptsForChat) {
            setReadReceiptsForChat(chatId, readReceipts);
            pendingReadReceiptsRef.current = null;
          } else {
            pendingReadReceiptsRef.current = { chatId, readReceipts };
          }
        }

        if (state.pts !== undefined && localPtsRef) {
          if (!localPtsRef.current) {
            localPtsRef.current = new Map();
          }
          const chatIdStr = String(chatId);
          localPtsRef.current.set(chatIdStr, state.pts);
        }
        if (state.seq !== undefined && localSeqRef) {
          if (localSeqRef.current === undefined) {
            localSeqRef.current = 0;
          }
          localSeqRef.current = state.seq;
        }

        if (state.oldestMessageId) {
          setOldestMessageId(state.oldestMessageId);
        }

        if (state.hasMoreMessages !== undefined) {
          setHasMore(state.hasMoreMessages);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      
    } finally {

      isLoadingInitialRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [upsertMessage, refreshChats, localPtsRef, localSeqRef, setReadReceiptsForChat, chatId]);

  const loadOlderMessages = useCallback(async (beforeMessageId) => {
    if (!chatId || !beforeMessageId || loadingMessagesRef.current) return;

    if (lastLoadedMessageIdRef.current === beforeMessageId) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    loadingMessagesRef.current = true;
    lastLoadedMessageIdRef.current = beforeMessageId;
    
    try {
      setLoadingMore(true);
      
      const response = await chatAPI.getMessagesBefore(chatId, beforeMessageId, OLDER_MESSAGES_LIMIT);
      
      if (Array.isArray(response?.content)) {
        const newMessages = response.content;
        if (newMessages.length === 0) {
          setHasMore(false);
          lastLoadedMessageIdRef.current = null;
          return;
        }

        for (const m of newMessages) {
          saveFileMetadata(m);
          upsertMessage(
            { ...m, status: MESSAGE_STATUS.SENT, isOptimistic: false },
            { unreadDelta: 0 }
          );
        }

        const newOldestId = newMessages[0]?.id;
        if (newOldestId && newOldestId !== oldestMessageId) {
          setOldestMessageId(newOldestId);
          lastLoadedMessageIdRef.current = null;
        } else {
          setHasMore(false);
          lastLoadedMessageIdRef.current = null;
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      
      lastLoadedMessageIdRef.current = null;
    } finally {
      setLoadingMore(false);
      loadingMessagesRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [chatId, upsertMessage, oldestMessageId]);

  const loadMessages = useCallback(async (pageNum = 0, append = false) => {
    if (!chatId) return;
    
    if (loadingMessagesRef.current && !append) {
      return;
    }
    
    if (!append) {
      
      return loadChatStateFull(chatId);
    } else if (append && oldestMessageId) {
      
      return loadOlderMessages(oldestMessageId);
    }
  }, [chatId, oldestMessageId, loadChatStateFull, loadOlderMessages]);

  useEffect(() => {
    if (!chatId) {
      setLoading(false);
    } else {
      lastLoadedMessageIdRef.current = null;
    }
  }, [chatId]);

  useEffect(() => {
    if (setReadReceiptsForChat && pendingReadReceiptsRef.current) {
      const { chatId: pendingChatId, readReceipts } = pendingReadReceiptsRef.current;
      setReadReceiptsForChat(pendingChatId, readReceipts);
      pendingReadReceiptsRef.current = null;
    }
  }, [setReadReceiptsForChat]);

  return {
    
    loading,
    loadingMore,
    hasMore,
    oldestMessageId,
    page,

    loadMessages,
    loadChatStateFull,
    loadOlderMessages,

    isLoadingInitialRef,
    loadingMessagesRef
  };
};

