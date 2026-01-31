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
import { useChatModals } from '@/components/chat/hooks/useChatModals';
import { useChatContextMenu } from '@/components/chat/hooks/useChatContextMenu';
import { useChatSelection } from '@/components/chat/hooks/useChatSelection';
import { useCall } from '@/context/CallContext';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import CallTypeModal from '@/component/CallTypeModal';
import ChatPresenter from './ChatPresenter';

const ChatContainer = ({ chatId }) => {
  const router = useRouter();
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
  
  const handleSelectCallType = useCallback((callType) => {
    if (!pendingCallTarget) return;
    
    const { targetUserId, chatIdForCall, targetUserInfo } = pendingCallTarget;
    
    if (typeof initiateCall === 'function') {
      initiateCall(targetUserId, callType, chatIdForCall, targetUserInfo);
    }
    
    setPendingCallTarget(null);
    setShowCallTypeModal(false);
  }, [pendingCallTarget, initiateCall]);
  
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
    setForwardModal
  } = useChatModals();

  const chatHook = useChat(chatId, {
    deleteConfirm,
    setDeleteConfirm,
    deleteForAll,
    setDeleteForAll,
    forwardModal,
    setForwardModal
  });
  
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
    onAutoSendRef,
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

  useEffect(() => {
    setContextMenuRef.current = setContextMenu;
  }, [setContextMenu, setContextMenuRef]);
  
  const {
    editingMessageId,
    editingContent,
    replyingToMessageId,
    replyingToMessage,
    setEditingContent
  } = messageActions;
  
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

  // Typing indicator
  const { 
    startTyping, 
    stopTyping, 
    typingUserIds 
  } = useTypingIndicator(chatId);

  // Таймер для остановки typing indicator
  const typingTimeoutRef = useRef(null);

  // Обертка для setNewMessage с typing indicator
  const handleNewMessageChange = useCallback((value) => {
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
        stopTyping();
      }, 3000);
    } else {
      // Если текст пустой, сразу останавливаем typing
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping();
    }
  }, [setNewMessage, startTyping, stopTyping]);

  // Остановить typing при размонтировании
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping();
    };
  }, [stopTyping]);

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

    prepareScrollForSending();

    if (fileToSend) {
      setUploadingFile(true);
      try {
        await sendFileMessage(fileToSend, messageText, replyToId);
        clearSelectedFile();
        if (messageActions.setReplyingToMessageId) {
          messageActions.setReplyingToMessageId(null);
        }
        if (messageActions.setReplyingToMessage) {
          messageActions.setReplyingToMessage(null);
        }
      } catch (error) {
        
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
      if (messageActions.setReplyingToMessageId) {
        messageActions.setReplyingToMessageId(null);
      }
      if (messageActions.setReplyingToMessage) {
        messageActions.setReplyingToMessage(null);
      }
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
    selectedFile,
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
    if (audioPreviewRef.current && isRecording && isLocked) {
      let currentBlobUrl = null;
      let lastChunksCount = 0;
      let lastBlobSize = 0;
      const revokedUrls = new Set();
      
      const updateAudioSrc = () => {
        if (!audioPreviewRef.current) return;
        
        const audio = audioPreviewRef.current;
        const isCurrentlyPlaying = !audio.paused && 
                                   !audio.ended && 
                                   audio.currentTime > 0 &&
                                   audio.readyState > 2;
        
        if (isCurrentlyPlaying || isPlayingPreview) {
          return;
        }
        
        const audioChunksRef = voiceRecording.audioChunksRef || { current: [] };
        if (audioChunksRef.current && audioChunksRef.current.length > 0) {
          const currentSize = audioChunksRef.current.reduce((sum, chunk) => sum + (chunk.size || 0), 0);
          if (audioChunksRef.current.length === lastChunksCount && currentSize === lastBlobSize) {
            return;
          }
          lastChunksCount = audioChunksRef.current.length;
          lastBlobSize = currentSize;
          
          try {
            const allChunks = Array.from(audioChunksRef.current);
            const previewBlob = new Blob(allChunks, { type: 'audio/webm' });
            if (previewBlob && previewBlob.size > 0) {
              const url = URL.createObjectURL(previewBlob);
              const oldSrc = audio.src;
              
              audio.src = url;
              
              if (oldSrc && oldSrc.startsWith('blob:') && oldSrc !== url && !revokedUrls.has(oldSrc)) {
                revokedUrls.add(oldSrc);
                audio.addEventListener('loadeddata', () => {
                  if (!revokedUrls.has(oldSrc)) {
                    revokedUrls.add(oldSrc);
                    setTimeout(() => {
                      try {
                        URL.revokeObjectURL(oldSrc);
                      } catch (e) {
                      }
                    }, 500);
                  }
                }, { once: true });
              }
              
              if (currentBlobUrl && currentBlobUrl.startsWith('blob:') && currentBlobUrl !== url && !revokedUrls.has(currentBlobUrl)) {
                revokedUrls.add(currentBlobUrl);
                setTimeout(() => {
                  try {
                    URL.revokeObjectURL(currentBlobUrl);
                  } catch (e) {
                  }
                }, 500);
              }
              
              currentBlobUrl = url;
              
              if (audio.readyState === 0) {
                audio.load();
              }
            }
          } catch (error) {
          }
        } else if (previewBlob && previewBlob.size > 0) {
          if (!currentBlobUrl || !audio.src || !audio.src.startsWith('blob:')) {
            try {
              const url = URL.createObjectURL(previewBlob);
              const oldSrc = audio.src;
              
              audio.src = url;
              
              if (oldSrc && oldSrc.startsWith('blob:') && oldSrc !== url && !revokedUrls.has(oldSrc)) {
                revokedUrls.add(oldSrc);
                audio.addEventListener('loadeddata', () => {
                  if (!revokedUrls.has(oldSrc)) {
                    revokedUrls.add(oldSrc);
                    setTimeout(() => {
                      try {
                        URL.revokeObjectURL(oldSrc);
                      } catch (e) {
                      }
                    }, 500);
                  }
                }, { once: true });
              }
              
              if (currentBlobUrl && currentBlobUrl.startsWith('blob:') && currentBlobUrl !== url && !revokedUrls.has(currentBlobUrl)) {
                revokedUrls.add(currentBlobUrl);
                setTimeout(() => {
                  try {
                    URL.revokeObjectURL(currentBlobUrl);
                  } catch (e) {
                  }
                }, 500);
              }
              
              currentBlobUrl = url;
              
              if (audio.readyState === 0) {
                audio.load();
              }
            } catch (error) {
            }
          }
        } else if (audioBlob && audioBlob.size > 0) {
          if (!currentBlobUrl || !audio.src || !audio.src.startsWith('blob:')) {
            try {
              const url = URL.createObjectURL(audioBlob);
              const oldSrc = audio.src;
              
              audio.src = url;
              
              if (oldSrc && oldSrc.startsWith('blob:') && oldSrc !== url && !revokedUrls.has(oldSrc)) {
                revokedUrls.add(oldSrc);
                audio.addEventListener('loadeddata', () => {
                  if (!revokedUrls.has(oldSrc)) {
                    revokedUrls.add(oldSrc);
                    setTimeout(() => {
                      try {
                        URL.revokeObjectURL(oldSrc);
                      } catch (e) {
                      }
                    }, 500);
                  }
                }, { once: true });
              }
              
              if (currentBlobUrl && currentBlobUrl.startsWith('blob:') && currentBlobUrl !== url && !revokedUrls.has(currentBlobUrl)) {
                revokedUrls.add(currentBlobUrl);
                setTimeout(() => {
                  try {
                    URL.revokeObjectURL(currentBlobUrl);
                  } catch (e) {
                  }
                }, 500);
              }
              
              currentBlobUrl = url;
              
              if (audio.readyState === 0) {
                audio.load();
              }
            } catch (error) {
            }
          }
        }
      };
      
      updateAudioSrc();
      
      const interval = setInterval(() => {
        if (!audioPreviewRef.current) return;
        updateAudioSrc();
      }, 1000);
      
      return () => {
        clearInterval(interval);
        if (currentBlobUrl && currentBlobUrl.startsWith('blob:') && !revokedUrls.has(currentBlobUrl)) {
          setTimeout(() => {
            try {
              URL.revokeObjectURL(currentBlobUrl);
            } catch (e) {
            }
          }, 1000);
        }
      };
    }
  }, [previewBlob, audioBlob, isRecording, isLocked, audioPreviewRef, voiceRecording, isPlayingPreview]);

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
    voiceRecording
  });

  useEffect(() => {
    onAutoSendRef.current = async (blob) => {
      if (blob && blob.size > 0) {
        await handleVoiceSendSimple(blob);
      }
    };
  }, [handleVoiceSendSimple, onAutoSendRef]);

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
      // Останавливаем запись
      handleStopRecording();
      
      // Ждем пока запись остановится и blob будет готов
      // MediaRecorder.onstop вызывается асинхронно, поэтому нужно подождать
      let attempts = 0;
      const maxAttempts = 50;
      let finalBlob = null;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Сначала проверяем готовый audioBlob (создается в onstop)
        if (audioBlobRef.current && audioBlobRef.current.size > 0) {
          finalBlob = audioBlobRef.current;
          break;
        }
        
        // Затем проверяем audioChunksRef напрямую (если onstop еще не вызвался)
        const audioChunksRef = voiceRecording.audioChunksRef || { current: [] };
        if (audioChunksRef.current && audioChunksRef.current.length > 0) {
          try {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            if (blob && blob.size > 0) {
              finalBlob = blob;
              // Не break сразу, продолжаем проверять audioBlob (он приоритетнее)
            }
          } catch (error) {
            console.error('Error creating blob from chunks:', error);
          }
        }
        
        // Проверяем previewBlob как запасной вариант
        if (!finalBlob && previewBlobRef.current && previewBlobRef.current.size > 0) {
          finalBlob = previewBlobRef.current;
        }
        
        if (!finalBlob && previewBlob && previewBlob.size > 0) {
          finalBlob = previewBlob;
        }
        
        if (!finalBlob && audioBlob && audioBlob.size > 0) {
          finalBlob = audioBlob;
        }
        
        // Если запись остановилась и есть blob, можно отправлять
        // Проверяем через voiceRecording.isRecording для актуального состояния
        const stillRecording = voiceRecording?.isRecording || false;
        if (finalBlob && finalBlob.size > 0 && !stillRecording) {
          break;
        }
        
        attempts++;
      }
      
      // Если все еще нет blob, пробуем создать из чанков в последний раз
      if (!finalBlob) {
        const audioChunksRef = voiceRecording.audioChunksRef || { current: [] };
        if (audioChunksRef.current && audioChunksRef.current.length > 0) {
          try {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            if (blob && blob.size > 0) {
              finalBlob = blob;
            }
          } catch (error) {
            console.error('Error creating final blob from chunks:', error);
          }
        }
      }
      
      // Отправляем blob
      if (finalBlob && finalBlob.size > 0) {
        await handleVoiceSendSimple(finalBlob);
      } else {
        // Если blob не найден, пробуем отправить что есть (handleVoiceSendSimple проверит)
        await handleVoiceSendSimple();
      }
    } else {
      // Если запись уже остановлена, просто отправляем
      const currentBlob = audioBlobRef.current || previewBlobRef.current || audioBlob || previewBlob;
      if (currentBlob && currentBlob.size > 0) {
        await handleVoiceSendSimple(currentBlob);
      } else {
        await handleVoiceSendSimple();
      }
    }
  }, [isRecording, audioBlob, previewBlob, handleStopRecording, handleVoiceSendSimple, voiceRecording]);

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
    loadMoreTimeoutRef
  });

  const { getReadMetaForMessage, getMessageStatusIcon } = useMessageStatus({
    chatId,
    chat,
    readAtByChatIdByUserId,
    user
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

