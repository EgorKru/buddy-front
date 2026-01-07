import { useState, useRef, useCallback, useEffect } from 'react';
import { chatAPI } from '@/utils/api';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { saveFileMetadata } from '../utils/messageHelpers';
import { INITIAL_MESSAGES_LIMIT, OLDER_MESSAGES_LIMIT } from '../constants/chat';

/**
 * Хук для загрузки и управления сообщениями чата
 */
export const useChatMessages = ({
  chatId,
  upsertMessage,
  refreshChats,
  localPtsRef,
  localSeqRef
}) => {
  const [loading, setLoading] = useState(!!chatId);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [oldestMessageId, setOldestMessageId] = useState(null);
  const [page, setPage] = useState(0);
  
  const abortControllerRef = useRef(null);
  const isLoadingInitialRef = useRef(false);
  const loadingMessagesRef = useRef(false);
  const lastLoadedMessageIdRef = useRef(null);

  /**
   * Загружает полное состояние чата одним запросом
   */
  const loadChatStateFull = useCallback(async (chatId) => {
    if (!chatId) return;
    
    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      isLoadingInitialRef.current = true;
      
      const state = await chatAPI.getChatStateFull(chatId, INITIAL_MESSAGES_LIMIT);
      
      if (state) {
        // Обновляем чат
        if (state.chat) {
          refreshChats();
        }
        
        // Загружаем сообщения
        if (state.messages && Array.isArray(state.messages)) {
          const ordered = [...state.messages].reverse();
          for (const m of ordered) {
            // Обработка метаданных файлов
            saveFileMetadata(m);
            upsertMessage(
              { ...m, status: MESSAGE_STATUS.SENT, isOptimistic: false },
              { unreadDelta: 0 }
            );
          }
        }
        
        // Обновляем последовательности
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
        
        // Устанавливаем курсор для следующей загрузки
        if (state.oldestMessageId) {
          setOldestMessageId(state.oldestMessageId);
        }
        
        // Обновляем флаг наличия еще сообщений
        if (state.hasMoreMessages !== undefined) {
          setHasMore(state.hasMoreMessages);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('[Load Chat State Full] Error:', error);
    } finally {
      setLoading(false);
      isLoadingInitialRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [upsertMessage, refreshChats, localPtsRef, localSeqRef]);

  /**
   * Загружает более старые сообщения (курсорная пагинация)
   */
  const loadOlderMessages = useCallback(async (beforeMessageId) => {
    if (!chatId || !beforeMessageId || loadingMessagesRef.current) return;
    
    // Защита от повторных запросов с тем же ID
    if (lastLoadedMessageIdRef.current === beforeMessageId) {
      return;
    }
    
    // Отменяем предыдущий запрос
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
        
        // Обрабатываем метаданные и добавляем сообщения
        for (const m of newMessages) {
          saveFileMetadata(m);
          upsertMessage(
            { ...m, status: MESSAGE_STATUS.SENT, isOptimistic: false },
            { unreadDelta: 0 }
          );
        }
        
        // Обновляем курсор только если получили новые сообщения
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
      console.error('[Load Older Messages] Error:', error);
      lastLoadedMessageIdRef.current = null;
    } finally {
      setLoadingMore(false);
      loadingMessagesRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [chatId, upsertMessage, oldestMessageId]);

  /**
   * Загружает сообщения (обертка для обратной совместимости)
   */
  const loadMessages = useCallback(async (pageNum = 0, append = false) => {
    if (!chatId) return;
    
    if (loadingMessagesRef.current && !append) {
      return;
    }
    
    if (!append) {
      // Первая загрузка
      return loadChatStateFull(chatId);
    } else if (append && oldestMessageId) {
      // Загрузка старых сообщений
      return loadOlderMessages(oldestMessageId);
    }
  }, [chatId, oldestMessageId, loadChatStateFull, loadOlderMessages]);

  useEffect(() => {
    if (!chatId) {
      setLoading(false);
    } else {
      // Сбрасываем защиту от повторных запросов при смене чата
      lastLoadedMessageIdRef.current = null;
    }
  }, [chatId]);

  return {
    // Состояние
    loading,
    loadingMore,
    hasMore,
    oldestMessageId,
    page,
    
    // Функции
    loadMessages,
    loadChatStateFull,
    loadOlderMessages,
    
    // Refs
    isLoadingInitialRef,
    loadingMessagesRef
  };
};

