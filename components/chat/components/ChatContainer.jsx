import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { getCurrentUser } from '@/utils/api';
import { useChat } from '@/components/chat/hooks/useChat';
import { useChatUI } from '@/components/chat/hooks/useChatUI';
import { useMessageEffects } from '@/components/chat/hooks/useMessageEffects';
import { useMessageStatus } from '@/components/chat/hooks/useMessageStatus';
import { useChatKeyboard } from '@/components/chat/hooks/useChatKeyboard';
import { useVoiceMessageHandling } from '@/components/chat/hooks/useVoiceMessageHandling';
import { useScrollHandlers } from '@/components/chat/hooks/useScrollHandlers';
import { useAudioPreviewSync } from '@/components/chat/hooks/useAudioPreviewSync';
import { useMessageSubmit } from '@/components/chat/hooks/useMessageSubmit';
import { useVoiceSendAndStop } from '@/components/chat/hooks/useVoiceSendAndStop';
import { useChatModals } from '@/components/chat/hooks/useChatModals';
import { useChatContextMenu } from '@/components/chat/hooks/useChatContextMenu';
import { useChatSelection } from '@/components/chat/hooks/useChatSelection';
import { useCall } from '@/context/CallContext';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import CallTypeModal from '@/component/CallTypeModal';
import ChatPresenter from './ChatPresenter';

const ChatContainer = ({ chatId }) => {
  const _router = useRouter();
  const user = getCurrentUser();

  const callContext = useCall();
  const { initiateCall } = callContext;
  const [showCallTypeModal, setShowCallTypeModal] = useState(false);
  const [pendingCallTarget, setPendingCallTarget] = useState(null);

  const handleOpenCallModal = useCallback((targetUserId, chatIdForCall, targetUserInfo) => {
    if (!targetUserId) {
      return;
    }
    setPendingCallTarget({ targetUserId, chatIdForCall, targetUserInfo });
    setShowCallTypeModal(true);
  }, []);

  const handleSelectCallType = useCallback(
    (callType) => {
      if (!pendingCallTarget) return;

      const { targetUserId, chatIdForCall, targetUserInfo } = pendingCallTarget;

      if (typeof initiateCall === 'function') {
        initiateCall(targetUserId, callType, chatIdForCall, targetUserInfo);
      }

      setPendingCallTarget(null);
      setShowCallTypeModal(false);
    },
    [pendingCallTarget, initiateCall]
  );

  const {
    imageModal,
    setImageModal,
    fileViewerModal,
    setFileViewerModal,
    deleteConfirm,
    setDeleteConfirm,
    deleteForAll,
    setDeleteForAll,
    forwardModal,
    setForwardModal,
  } = useChatModals();

  const { startTyping, stopTyping, typingUserIds, clearTypingForUser } = useTypingIndicator(chatId);
  const typingTimeoutRef = useRef(null);

  const dismissLocalTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    stopTyping();
  }, [stopTyping]);

  const onPeerMessage = useCallback(
    (senderId) => clearTypingForUser(senderId),
    [clearTypingForUser]
  );

  const chatHook = useChat(
    chatId,
    {
      deleteConfirm,
      setDeleteConfirm,
      deleteForAll,
      setDeleteForAll,
      forwardModal,
      setForwardModal,
    },
    { onPeerMessage }
  );

  const {
    chatContext,
    chat,
    messages,
    loading: messagesLoading,
    loadingMore,
    hasMore,
    oldestMessageId,
    loadMessages,
    loadOlderMessages,
    isLoadingInitialRef,
    pinnedMessages,
    viewedPinnedMessageId,
    setViewedPinnedMessageId,
    selectionMode,
    selectedMessages,
    handleSelectMessageBase,
    toggleMessageSelection,
    handleSelectAllBase,
    exitSelectionMode,
    saveScrollPosition,
    restoreScrollPosition,
    scrollToBottom,
    checkIsAtBottom,
    unreadCount,
    scrollPositionSavedRef,
    userScrolledToBottomRef,
    isUserScrollingUpRef,
    isRestoringScrollRef,
    lastScrollTopRef,
    scrollHeightBeforeMessageRef,
    wasAtBottomBeforeMessageRef,
    shouldAutoScrollRef,
    shouldRestorePositionRef,
    handleNavigateToMessage,
    searchText,
    setSearchText,
    searchResults,
    isSearching: _isSearching,
    searchMode,
    searchOpen,
    searchInputRef,
    handleSearchSubmit,
    handleOpenSearch,
    handleCloseSearch,
    handleNavigateToSearchResult,
    messageActions,
    voiceRecording,
    fileUpload,
    handlePinSelected,
    handleUnpinSelected,
    handleDeleteSelected,
    handleForwardSelected,
    sendTextMessage,
    sendFileMessage,
    sendMessageHook,
    sending,
    syncQueue,
    messagesContainerRef,
    messageInputRef,
    sentAudioBlobRef,
    newMessageIdsRef,
    isAutoScrollingRef,
    loadedMessageIdsRef,
    scrollStateRef,
    setContextMenuRef,
    onAutoSendRef,
    scrollTimeoutRef,
    loadMoreTimeoutRef,
    isUserScrollingRef,
    prepareScrollForSending,
  } = chatHook;

  const {
    newMessage,
    setNewMessage,
    sidebarOpen,
    setSidebarOpen,
    contextMenu,
    setContextMenu,
    showScrollToBottom,
    setShowScrollToBottom,
    scrollButtonReady,
    setScrollButtonReady,
  } = useChatUI();

  useEffect(() => {
    setContextMenuRef.current = setContextMenu;
  }, [setContextMenu, setContextMenuRef]);

  const {
    editingMessageId,
    editingContent,
    replyingToMessageId,
    replyingToMessage,
    setEditingContent,
  } = messageActions;

  const {
    uploadingFile,
    setUploadingFile,
    selectedFile,
    setSelectedFile,
    selectedFileUrlRef,
    fileInputRef,
    clearSelectedFile,
  } = fileUpload;

  const {
    connected,
    readAtByChatIdByUserId,
    addOptimistic,
    chats,
    upsertMessage: _upsertMessage,
  } = chatContext;

  // Обертка для setNewMessage с typing indicator
  const handleNewMessageChange = useCallback(
    (value) => {
      setNewMessage(value);

      // Если есть текст, отправляем typing indicator
      if (value && value.trim()) {
        startTyping();

        // Сбросить предыдущий таймаут
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Остановить typing indicator через 3 секунды
        typingTimeoutRef.current = setTimeout(() => {
          dismissLocalTyping();
        }, 3000);
      } else {
        dismissLocalTyping();
      }
    },
    [setNewMessage, startTyping, dismissLocalTyping]
  );

  useEffect(() => {
    return () => {
      dismissLocalTyping();
    };
  }, [dismissLocalTyping]);

  useMessageEffects({
    messages,
    scrollPositionSavedRef,
    messagesContainerRef,
    isLoadingInitialRef,
    shouldRestorePositionRef,
    restoreScrollPosition,
    scrollHeightBeforeMessageRef,
    wasAtBottomBeforeMessageRef,
    shouldAutoScrollRef,
    checkIsAtBottom,
    scrollToBottom,
    userScrolledToBottomRef,
    isUserScrollingUpRef,
    lastScrollTopRef,
  });

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    previewBlob,
    error: voiceError,
    audioLevel,
    isLocked,
    isHolding,
    dragDistance,
    isPlayingPreview,
    reachedLockThreshold,
    lockThreshold,
    buttonRef,
    audioPreviewRef,
    handleMouseDown,
    handleTouchStart,
    handlePauseRecording,
    handleResumeRecording,
    handleStopRecording,
    handleCancelRecording: _handleCancelRecording,
    handlePlayPreview,
    cancelRecording,
    reset: resetVoice,
    convertToBase64: _convertToBase64,
  } = voiceRecording;

  useEffect(() => {
    if (connected && chatId) {
      syncQueue();
    }
  }, [connected, chatId, syncQueue]);

  const { handleContextMenu, handleCloseContextMenu } = useChatContextMenu(
    setContextMenu,
    messageActions
  );

  const handleCopyMessage = messageActions.handleCopyMessage;
  const handleDeleteMessage = messageActions.handleDeleteMessage;
  const handleConfirmDelete = messageActions.handleConfirmDelete;
  const handleEditMessage = messageActions.handleEditMessage;
  const handleSaveEdit = messageActions.handleSaveEdit;
  const handleCancelEdit = messageActions.handleCancelEdit;
  const handleReplyMessage = messageActions.handleReplyMessage;
  const handleCancelReply = messageActions.handleCancelReply;
  const handlePinMessage = messageActions.handlePinMessage;
  const handleUnpinMessage = messageActions.handleUnpinMessage;
  const handleForwardMessage = messageActions.handleForwardMessage;
  const handleConfirmForward = messageActions.handleConfirmForward;

  const sendMessage = useMessageSubmit({
    editingMessageId,
    handleSaveEdit,
    newMessage,
    selectedFile,
    user,
    sending,
    uploadingFile,
    replyingToMessageId,
    replyingToMessage,
    setNewMessage,
    messageActions,
    dismissLocalTyping,
    prepareScrollForSending,
    sendFileMessage,
    sendTextMessage,
    clearSelectedFile,
    setSelectedFile,
    setUploadingFile,
    selectedFileUrlRef,
  });

  const { handleKeyDown } = useChatKeyboard({
    editingMessageId,
    sending,
    isRecording,
    editingContent,
    newMessage,
    selectedFile,
    handleSaveEdit,
    handleCancelEdit,
    sendMessage,
  });

  const { handleSelectMessage, handleSelectAll } = useChatSelection({
    selectionMode,
    selectedMessages,
    handleSelectMessageBase,
    toggleMessageSelection,
    handleSelectAllBase,
    exitSelectionMode,
    messages,
    setContextMenu,
  });

  useAudioPreviewSync(audioPreviewRef, isRecording, isLocked, voiceRecording, isPlayingPreview);

  const {
    handleVoiceSendSimple,
    handleVoiceSend: _handleVoiceSend,
    handleVoiceCancel: _handleVoiceCancel,
  } = useVoiceMessageHandling({
    audioBlob,
    user,
    sending,
    chatId,
    sendMessageHook,
    addOptimistic,
    recordingTime,
    checkIsAtBottom,
    scrollHeightBeforeMessageRef,
    wasAtBottomBeforeMessageRef,
    shouldAutoScrollRef,
    messagesContainerRef,
    newMessageIdsRef,
    resetVoice,
    sentAudioBlobRef,
    isRecording,
    isLocked,
    voiceError,
    cancelRecording,
    voiceRecording,
  });

  useEffect(() => {
    onAutoSendRef.current = async (blob) => {
      if (blob && blob.size > 0) {
        await handleVoiceSendSimple(blob);
      }
    };
  }, [handleVoiceSendSimple, onAutoSendRef]);

  const handleVoiceSendAndStop = useVoiceSendAndStop({
    isRecording,
    handleStopRecording,
    handleVoiceSendSimple,
    voiceRecording,
    audioBlob,
    previewBlob,
  });

  useEffect(() => {
    scrollStateRef.current = { hasMore, loadingMore, oldestMessageId };
  }, [hasMore, loadingMore, oldestMessageId, scrollStateRef]);

  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef.current && !messagesLoading) {
      setScrollButtonReady(true);
    }
  }, [messages.length, messagesLoading, messagesContainerRef, setScrollButtonReady]);

  const { handleScrollThrottled } = useScrollHandlers({
    messagesContainerRef,
    isLoadingInitialRef,
    isAutoScrollingRef,
    lastScrollTopRef,
    isUserScrollingUpRef,
    scrollStateRef,
    loadOlderMessages,
    loadMessages,
    saveScrollPosition,
    checkIsAtBottom,
    setShowScrollToBottom,
    userScrolledToBottomRef,
    isRestoringScrollRef,
    isUserScrollingRef,
    scrollTimeoutRef,
    loadMoreTimeoutRef,
  });

  const { getReadMetaForMessage, getMessageStatusIcon } = useMessageStatus({
    chatId,
    chat,
    readAtByChatIdByUserId,
    user,
  });

  return (
    <>
      <ChatPresenter
        chat={chat}
        messages={messages}
        messagesLoading={messagesLoading}
        loadingMore={loadingMore}
        user={user}
        chatId={chatId}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        contextMenu={contextMenu}
        handleContextMenu={handleContextMenu}
        handleCloseContextMenu={handleCloseContextMenu}
        selectionMode={selectionMode}
        selectedMessages={selectedMessages}
        handleSelectAll={handleSelectAll}
        exitSelectionMode={exitSelectionMode}
        handleForwardSelected={handleForwardSelected}
        handlePinSelected={handlePinSelected}
        handleUnpinSelected={handleUnpinSelected}
        handleDeleteSelected={handleDeleteSelected}
        pinnedMessages={pinnedMessages}
        viewedPinnedMessageId={viewedPinnedMessageId}
        setViewedPinnedMessageId={setViewedPinnedMessageId}
        handleUnpinMessage={handleUnpinMessage}
        handleNavigateToMessage={handleNavigateToMessage}
        messagesContainerRef={messagesContainerRef}
        handleScrollThrottled={handleScrollThrottled}
        scrollButtonReady={scrollButtonReady}
        showScrollToBottom={showScrollToBottom}
        scrollToBottom={scrollToBottom}
        unreadCount={unreadCount}
        toggleMessageSelection={toggleMessageSelection}
        getReadMetaForMessage={getReadMetaForMessage}
        getMessageStatusIcon={getMessageStatusIcon}
        searchOpen={searchOpen}
        searchText={searchText}
        searchMode={searchMode}
        searchResults={searchResults}
        handleOpenSearch={handleOpenSearch}
        handleCloseSearch={handleCloseSearch}
        handleSearchSubmit={handleSearchSubmit}
        setSearchText={setSearchText}
        handleNavigateToSearchResult={handleNavigateToSearchResult}
        searchInputRef={searchInputRef}
        newMessageIdsRef={newMessageIdsRef}
        loadedMessageIdsRef={loadedMessageIdsRef}
        imageModal={imageModal}
        setImageModal={setImageModal}
        fileViewerModal={fileViewerModal}
        setFileViewerModal={setFileViewerModal}
        voiceError={voiceError}
        newMessage={newMessage}
        setNewMessage={handleNewMessageChange}
        editingMessageId={editingMessageId}
        editingContent={editingContent}
        setEditingContent={setEditingContent}
        replyingToMessage={replyingToMessage}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        selectedFileUrlRef={selectedFileUrlRef}
        isRecording={isRecording}
        isLocked={isLocked}
        isHolding={isHolding}
        dragDistance={dragDistance}
        reachedLockThreshold={reachedLockThreshold}
        lockThreshold={lockThreshold}
        isPaused={isPaused}
        isPlayingPreview={isPlayingPreview}
        sending={sending}
        uploadingFile={uploadingFile}
        messageInputRef={messageInputRef}
        fileInputRef={fileInputRef}
        buttonRef={buttonRef}
        audioPreviewRef={audioPreviewRef}
        sendMessage={sendMessage}
        handleSaveEdit={handleSaveEdit}
        handleCancelEdit={handleCancelEdit}
        handleCancelReply={handleCancelReply}
        handleMouseDown={handleMouseDown}
        handleTouchStart={handleTouchStart}
        handleKeyDown={handleKeyDown}
        pauseRecording={handlePauseRecording}
        resumeRecording={handleResumeRecording}
        handleVoiceSendSimple={handleVoiceSendAndStop}
        cancelRecording={cancelRecording}
        handlePlayPreview={handlePlayPreview}
        recordingTime={recordingTime}
        audioLevel={audioLevel}
        clearSelectedFile={clearSelectedFile}
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        deleteForAll={deleteForAll}
        setDeleteForAll={setDeleteForAll}
        handleConfirmDelete={handleConfirmDelete}
        forwardModal={forwardModal}
        setForwardModal={setForwardModal}
        chats={chats}
        handleConfirmForward={handleConfirmForward}
        handleCopyMessage={handleCopyMessage}
        handleDeleteMessage={handleDeleteMessage}
        handleEditMessage={handleEditMessage}
        handleReplyMessage={handleReplyMessage}
        handlePinMessage={handlePinMessage}
        handleForwardMessage={handleForwardMessage}
        handleSelectMessage={handleSelectMessage}
        onStartCall={handleOpenCallModal}
        typingUserIds={typingUserIds}
      />

      {}
      <CallTypeModal
        isOpen={showCallTypeModal}
        onClose={() => {
          setShowCallTypeModal(false);
          setPendingCallTarget(null);
        }}
        targetUser={pendingCallTarget?.targetUserInfo}
        onSelectAudio={() => handleSelectCallType('AUDIO')}
        onSelectVideo={() => handleSelectCallType('VIDEO')}
      />
    </>
  );
};

export default ChatContainer;
