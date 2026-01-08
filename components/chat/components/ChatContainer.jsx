import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { getCurrentUser } from '@/utils/api';
import { useChat } from '@/components/chat/hooks/useChat';
import { useChatUI } from '@/components/chat/hooks/useChatUI';
import { useMessageEffects } from '@/components/chat/hooks/useMessageEffects';
import { useWebSocketMessages } from '@/components/chat/hooks/useWebSocketMessages';
import { useMessageStatus } from '@/components/chat/hooks/useMessageStatus';
import { useChatKeyboard } from '@/components/chat/hooks/useChatKeyboard';
import { useVoiceMessageHandling } from '@/components/chat/hooks/useVoiceMessageHandling';
import { useScrollHandlers } from '@/components/chat/hooks/useScrollHandlers';
import { useChatModals } from '@/components/chat/hooks/useChatModals';
import { useChatContextMenu } from '@/components/chat/hooks/useChatContextMenu';
import { useChatSelection } from '@/components/chat/hooks/useChatSelection';
import ChatPresenter from './ChatPresenter';

const ChatContainer = ({ chatId }) => {
  const router = useRouter();
  const user = getCurrentUser();
  
  const chatHook = useChat(chatId);
  
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
    isSearching,
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
    scrollTimeoutRef,
    loadMoreTimeoutRef,
    isUserScrollingRef,
    prepareScrollForSending
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
    setScrollButtonReady
  } = useChatUI();

  const {
    imageModal,
    setImageModal,
    deleteConfirm,
    setDeleteConfirm,
    forwardModal,
    setForwardModal
  } = useChatModals();
  
  useEffect(() => {
    setContextMenuRef.current = setContextMenu;
  }, [setContextMenu, setContextMenuRef]);
  
  const {
    editingMessageId,
    editingContent,
    replyingToMessageId,
    replyingToMessage,
    deleteForAll,
    setEditingContent,
    setDeleteForAll
  } = messageActions;

  useEffect(() => {
    if (messageActions.setDeleteConfirm && deleteConfirm !== messageActions.deleteConfirm) {
      messageActions.setDeleteConfirm(deleteConfirm);
    }
  }, [deleteConfirm, messageActions]);

  useEffect(() => {
    if (messageActions.setForwardModal && forwardModal !== messageActions.forwardModal) {
      messageActions.setForwardModal(forwardModal);
    }
  }, [forwardModal, messageActions]);
  
  const {
    uploadingFile,
    setUploadingFile,
    selectedFile,
    setSelectedFile,
    selectedFileUrlRef,
    fileInputRef,
    clearSelectedFile
  } = fileUpload;
  
  const { 
    connected, 
    readAtByChatIdByUserId, 
    addOptimistic, 
    chats, 
    upsertMessage
  } = chatContext;

  useWebSocketMessages({
    upsertMessage,
    newMessageIdsRef
  });

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
    lastScrollTopRef
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
    handleCancelRecording,
    handlePlayPreview,
    cancelRecording,
    reset: resetVoice,
    convertToBase64
  } = voiceRecording;

  useEffect(() => {
    if (connected && chatId) {
      syncQueue();
    }
  }, [connected, chatId, syncQueue]);

  const {
    handleContextMenu,
    handleCloseContextMenu
  } = useChatContextMenu(setContextMenu, messageActions);

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

  const sendMessage = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (editingMessageId) {
      await handleSaveEdit();
      return;
    }
    
    if ((!newMessage.trim() && !selectedFile) || !user || sending || uploadingFile) return;
    
    const messageText = newMessage.trimEnd();
    const replyToId = replyingToMessageId;
    const fileToSend = selectedFile;
    
    setNewMessage('');
    if (messageActions.setReplyingToMessageId) {
      messageActions.setReplyingToMessageId(null);
    }
    if (messageActions.setReplyingToMessage) {
      messageActions.setReplyingToMessage(null);
    }

    prepareScrollForSending();

    if (fileToSend) {
      setUploadingFile(true);
      try {
        await sendFileMessage(fileToSend, messageText, replyToId);
        clearSelectedFile();
      } catch (error) {
        console.error('Error uploading and sending file:', error);
        alert(`Не удалось отправить файл: ${error.message || 'Неизвестная ошибка'}`);
        setSelectedFile(fileToSend);
        if (fileToSend && fileToSend.type.startsWith('image/') && !selectedFileUrlRef.current) {
          selectedFileUrlRef.current = URL.createObjectURL(fileToSend);
        }
      } finally {
        setUploadingFile(false);
      }
      return;
    }

    if (messageText) {
      await sendTextMessage(messageText, replyToId);
    }
  }, [
    editingMessageId,
    handleSaveEdit,
    newMessage,
    selectedFile,
    user,
    sending,
    uploadingFile,
    replyingToMessageId,
    setNewMessage,
    messageActions,
    prepareScrollForSending,
    sendFileMessage,
    sendTextMessage,
    clearSelectedFile,
    setSelectedFile,
    setUploadingFile,
    selectedFileUrlRef
  ]);

  const { handleKeyDown } = useChatKeyboard({
    editingMessageId,
    sending,
    isRecording,
    editingContent,
    newMessage,
    handleSaveEdit,
    handleCancelEdit,
    sendMessage
  });

  const {
    handleSelectMessage,
    handleSelectAll
  } = useChatSelection({
    selectionMode,
    selectedMessages,
    handleSelectMessageBase,
    toggleMessageSelection,
    handleSelectAllBase,
    exitSelectionMode,
    messages,
    setContextMenu
  });

  useEffect(() => {
    if (audioPreviewRef.current && (previewBlob || audioBlob) && isRecording && isLocked && isPaused) {
      if (audioPreviewRef.current.src && audioPreviewRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioPreviewRef.current.src);
      }
      const blob = previewBlob || audioBlob;
      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        audioPreviewRef.current.src = url;
        audioPreviewRef.current.load();
      }
    }
    return () => {
      if (audioPreviewRef.current && audioPreviewRef.current.src && audioPreviewRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioPreviewRef.current.src);
      }
    };
  }, [previewBlob, audioBlob, isRecording, isLocked, isPaused, audioPreviewRef]);

  const {
    handleVoiceSendSimple,
    handleVoiceSend,
    handleVoiceCancel
  } = useVoiceMessageHandling({
    audioBlob,
    user,
    sending,
    chatId,
    sendMessageHook,
    addOptimistic,
    convertToBase64,
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
    cancelRecording
  });

  const audioBlobRef = useRef(audioBlob);
  const previewBlobRef = useRef(previewBlob);
  useEffect(() => {
    audioBlobRef.current = audioBlob;
  }, [audioBlob]);
  useEffect(() => {
    previewBlobRef.current = previewBlob;
  }, [previewBlob]);

  const handleVoiceSendAndStop = useCallback(async () => {
    if (isRecording) {
      handleStopRecording();
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts && (!audioBlobRef.current || audioBlobRef.current.size === 0)) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
    }
    const currentBlob = audioBlobRef.current || previewBlobRef.current || audioBlob || previewBlob;
    if (currentBlob && currentBlob.size > 0) {
      await handleVoiceSendSimple(currentBlob);
    } else {
      await handleVoiceSendSimple();
    }
  }, [isRecording, audioBlob, previewBlob, handleStopRecording, handleVoiceSendSimple]);

  useEffect(() => {
    scrollStateRef.current = { hasMore, loadingMore, oldestMessageId };
  }, [hasMore, loadingMore, oldestMessageId, scrollStateRef]);

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
    loadMoreTimeoutRef
  });

  const { getReadMetaForMessage, getMessageStatusIcon } = useMessageStatus({
    chatId,
    chat,
    readAtByChatIdByUserId,
    user
  });

  return (
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
      setImageModal={setImageModal}
      voiceError={voiceError}
      newMessage={newMessage}
      setNewMessage={setNewMessage}
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
      imageModal={imageModal}
      setImageModal={setImageModal}
      handleCopyMessage={handleCopyMessage}
      handleDeleteMessage={handleDeleteMessage}
      handleEditMessage={handleEditMessage}
      handleReplyMessage={handleReplyMessage}
      handlePinMessage={handlePinMessage}
      handleForwardMessage={handleForwardMessage}
      handleSelectMessage={handleSelectMessage}
    />
  );
};

export default ChatContainer;

