import { useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { getCurrentUser, isAuthenticated } from '@/utils/api';
import { useChats, useChatMessages } from '@/context/messaging';
import { useStomp } from '@/context/socket';
import { useChatRealtime } from '@/hooks/useChatRealtime';
import { usePinnedMessages } from '@/hooks/usePinnedMessages';
import { useMessageSelection } from '@/hooks/useMessageSelection';
import { useMessageSender } from '@/hooks/useMessageSender';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { useChatMessages as useChatMessagesHook } from './useChatMessages';
import { useScrollManagement } from './useScrollManagement';
import { useMessageActions } from './useMessageActions';
import { useMessageNavigation } from './useMessageNavigation';
import { useMessageSearch } from './useMessageSearch';
import { useVoiceRecordingUI } from './useVoiceRecordingUI';
import { useFileUpload } from './useFileUpload';
import { useBulkMessageActions } from './useBulkMessageActions';
import { useStateSync } from './useStateSync';
import { useChatInitialization } from './useChatInitialization';
import { useMessageSending } from './useMessageSending';

export const useChat = (chatId) => {
  const router = useRouter();
  const user = getCurrentUser();
  
  const chatContext = useChats();
  const { client, localSeqRef, localPtsRef, gapRecoveryInProgressRef } = useStomp();
  const messages = useChatMessages(chatId);
  
  const chat = useMemo(() => {
    if (!chatId) return null;
    return chatContext.chats.find(c => String(c?.id) === String(chatId)) || null;
  }, [chatId, chatContext.chats]);
  
  const messagesContainerRef = useRef(null);
  const messageInputRef = useRef(null);
  const sentAudioBlobRef = useRef(null);
  const newMessageIdsRef = useRef(new Set());
  const isAutoScrollingRef = useRef(false);
  const loadedMessageIdsRef = useRef(new Set());
  const isRestoringScrollPositionRef = useRef(false);
  const correctionFrameIdRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const correctionTimeoutRef = useRef(null);
  const scrollStateRef = useRef({ hasMore: false, loadingMore: false, oldestMessageId: null });
  const abortControllerRef = useRef(null);
  
  const {
    loading: messagesLoading,
    loadingMore,
    hasMore,
    oldestMessageId,
    page,
    loadMessages,
    loadChatStateFull,
    loadOlderMessages,
    isLoadingInitialRef
  } = useChatMessagesHook({
    chatId,
    upsertMessage: chatContext.upsertMessage,
    refreshChats: chatContext.refreshChats,
    localPtsRef,
    localSeqRef
  });
  
  const {
    pinnedMessages,
    viewedPinnedMessageId,
    setViewedPinnedMessageId,
    setPinnedMessages,
    loadPinnedMessages,
  } = usePinnedMessages(chatId, messages);
  
  const {
    selectionMode,
    selectedMessages,
    handleSelectMessage: handleSelectMessageBase,
    toggleMessageSelection,
    handleSelectAll: handleSelectAllBase,
    exitSelectionMode,
  } = useMessageSelection();
  
  const scrollManagement = useScrollManagement({
    chatId,
    messages,
    messagesContainerRef,
    isLoadingInitial: isLoadingInitialRef.current,
    hasMore,
    loadingMore,
    oldestMessageId,
    onLoadOlderMessages: loadOlderMessages
  });
  
  const {
    scrollPositionSavedRef,
    userScrolledToBottomRef,
    restoreAttemptsRef,
    shouldRestorePositionRef,
    lastScrollTopRef,
    isUserScrollingUpRef,
    scrollTimeoutRef,
    loadMoreTimeoutRef,
    isUserScrollingRef,
    ...restScrollManagement
  } = scrollManagement;
  
  const { handleNavigateToMessage } = useMessageNavigation({
    chatId,
    upsertMessage: chatContext.upsertMessage,
    isRestoringScrollRef: scrollManagement.isRestoringScrollRef
  });
  
  const messageSearch = useMessageSearch({
    chatId,
    onNavigateToMessage: handleNavigateToMessage
  });
  
  const setContextMenuRef = useRef(null);
  
  const messageActions = useMessageActions({
    chatId,
    messages,
    pinnedMessages,
    setPinnedMessages,
    updateMessage: chatContext.updateMessage,
    removeMessage: chatContext.removeMessage,
    loadPinnedMessages,
    setContextMenu: (menu) => {
      if (setContextMenuRef.current) {
        setContextMenuRef.current(menu);
      }
    },
    messageInputRef,
    viewedPinnedMessageId,
    setViewedPinnedMessageId,
    selectionMode,
    exitSelectionMode
  });
  
  const voiceRecording = useVoiceRecordingUI();
  const fileUpload = useFileUpload();
  
  const bulkMessageActions = useBulkMessageActions({
    chatId,
    messages,
    pinnedMessages,
    updateMessage: chatContext.updateMessage,
    setPinnedMessages,
    loadPinnedMessages,
    exitSelectionMode,
    setDeleteConfirm: messageActions.setDeleteConfirm,
    setForwardModal: messageActions.setForwardModal
  });
  
  useChatRealtime(chatId);
  
  useStateSync({
    upsertMessage: chatContext.upsertMessage,
    localSeqRef,
    localPtsRef,
    gapRecoveryInProgressRef
  });

  useChatInitialization({
    chatId,
    router,
    isAuthenticated,
    refreshChats: chatContext.refreshChats,
    loadChatStateFull,
    loadPinnedMessages,
    chat,
    clearSelectedFile: fileUpload?.clearSelectedFile || (() => {}),
    scrollPositionSavedRef,
    userScrolledToBottomRef,
    restoreAttemptsRef,
    shouldRestorePositionRef,
    lastScrollTopRef,
    isUserScrollingUpRef,
    isLoadingInitialRef
  });
  
  const { sendMessage: sendMessageHook, sending, syncQueue } = useMessageSender(chatId);
  
  const messageSending = useMessageSending({
    chatId,
    user,
    sendMessageHook,
    addOptimistic: chatContext.addOptimistic,
    checkIsAtBottom: restScrollManagement.checkIsAtBottom,
    saveScrollPosition: restScrollManagement.saveScrollPosition,
    scrollHeightBeforeMessageRef: restScrollManagement.scrollHeightBeforeMessageRef,
    wasAtBottomBeforeMessageRef: restScrollManagement.wasAtBottomBeforeMessageRef,
    shouldAutoScrollRef: restScrollManagement.shouldAutoScrollRef,
    newMessageIdsRef,
    messagesContainerRef
  });
  
  return {
    chatContext,
    user,
    router,
    client,
    localSeqRef,
    localPtsRef,
    gapRecoveryInProgressRef,
    chat,
    messages,
    
    // Загрузка сообщений
    loading: messagesLoading,
    loadingMore,
    hasMore,
    oldestMessageId,
    page,
    loadMessages,
    loadChatStateFull,
    loadOlderMessages,
    isLoadingInitialRef,
    
    // Закрепленные сообщения
    pinnedMessages,
    viewedPinnedMessageId,
    setViewedPinnedMessageId,
    setPinnedMessages,
    loadPinnedMessages,
    
    // Выбор сообщений
    selectionMode,
    selectedMessages,
    handleSelectMessageBase,
    toggleMessageSelection,
    handleSelectAllBase,
    exitSelectionMode,
    
    // Управление скроллом
    ...restScrollManagement,
    scrollPositionSavedRef,
    userScrolledToBottomRef,
    restoreAttemptsRef,
    shouldRestorePositionRef,
    lastScrollTopRef,
    isUserScrollingUpRef,
    
    // Навигация
    handleNavigateToMessage,
    
    // Поиск
    ...messageSearch,
    
    // Действия с сообщениями
    messageActions,
    
    // Голосовая запись
    voiceRecording,
    
    // Загрузка файлов
    fileUpload,
    
    // Массовые операции
    ...bulkMessageActions,
    
    // Отправка сообщений
    ...messageSending,
    prepareScrollForSending: messageSending.prepareScrollForSending,
    sending,
    syncQueue,
    
    // Refs
    messagesContainerRef,
    messageInputRef,
    sentAudioBlobRef,
    newMessageIdsRef,
    isAutoScrollingRef,
    loadedMessageIdsRef,
    isRestoringScrollPositionRef,
    correctionFrameIdRef,
    resizeObserverRef,
    correctionTimeoutRef,
    scrollStateRef,
    abortControllerRef,
    setContextMenuRef,
    scrollTimeoutRef,
    loadMoreTimeoutRef,
    isUserScrollingRef
  };
};

