import { useEffect } from 'react';
import ChatSidebar from '@/component/ChatSidebar';
import MessageContextMenu from '@/component/MessageContextMenu';
import ImageModal from '@/component/ImageModal';
import FileViewerModal from '@/component/FileViewerModal';
import styles from '@/styles/chat.module.css';
import PinnedMessagesHeader from '@/component/PinnedMessagesHeader';
import DeleteConfirmModal from '@/component/DeleteConfirmModal';
import ForwardModal from '@/component/ForwardModal';
import SelectionHeader from '@/component/SelectionHeader';
import ChatHeader from '@/components/chat/components/ChatHeader';
import MessageList from '@/components/chat/components/MessageList';
import MessageInputArea from '@/components/chat/components/MessageInputArea';
import { ErrorMessage } from '@/components/chat/components/ErrorMessage';

const ChatPresenter = ({
  chat,
  messages,
  messagesLoading,
  loadingMore,
  user,
  chatId,
  sidebarOpen,
  setSidebarOpen,
  contextMenu,
  handleContextMenu,
  handleCloseContextMenu,
  selectionMode,
  selectedMessages,
  handleSelectAll,
  exitSelectionMode,
  handleForwardSelected,
  handlePinSelected,
  handleUnpinSelected,
  handleDeleteSelected,
  pinnedMessages,
  viewedPinnedMessageId,
  setViewedPinnedMessageId,
  handleUnpinMessage,
  handleNavigateToMessage,
  messagesContainerRef,
  handleScrollThrottled,
  scrollButtonReady,
  showScrollToBottom,
  scrollToBottom,
  unreadCount,
  toggleMessageSelection,
  getReadMetaForMessage,
  getMessageStatusIcon,
  searchOpen,
  searchText,
  searchMode,
  searchResults,
  handleOpenSearch,
  handleCloseSearch,
  handleSearchSubmit,
  setSearchText,
  handleNavigateToSearchResult,
  searchInputRef,
  newMessageIdsRef,
  loadedMessageIdsRef,
  voiceError,
  newMessage,
  setNewMessage,
  editingMessageId,
  editingContent,
  setEditingContent,
  replyingToMessage,
  selectedFile,
  setSelectedFile,
  selectedFileUrlRef,
  isRecording,
  isLocked,
  isHolding,
  dragDistance,
  reachedLockThreshold,
  lockThreshold,
  isPaused,
  isPlayingPreview,
  sending,
  uploadingFile,
  messageInputRef,
  fileInputRef,
  buttonRef,
  audioPreviewRef,
  sendMessage,
  handleSaveEdit,
  handleCancelEdit,
  handleCancelReply,
  handleMouseDown,
  handleTouchStart,
  handleKeyDown,
  pauseRecording,
  resumeRecording,
  handleVoiceSendSimple,
  cancelRecording,
  handlePlayPreview,
  recordingTime,
  audioLevel,
  clearSelectedFile,
  deleteConfirm,
  setDeleteConfirm,
  deleteForAll,
  setDeleteForAll,
  handleConfirmDelete,
  forwardModal,
  setForwardModal,
  chats,
  handleConfirmForward,
  imageModal,
  setImageModal,
  fileViewerModal,
  setFileViewerModal,
  handleCopyMessage,
  handleDeleteMessage,
  handleEditMessage,
  handleReplyMessage,
  handlePinMessage,
  handleForwardMessage,
  handleSelectMessage
}) => {
  if (messagesLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка чата...</div>
      </div>
    );
  }

  const selectedMessagesList = selectionMode 
    ? Array.from(selectedMessages).map(id => 
        messages.find(m => Number(m.id) === Number(id))
      ).filter(Boolean)
    : [];

  const allPinned = selectedMessagesList.length > 0 && selectedMessagesList.every(msg => {
    const isPinnedInList = pinnedMessages.some(p => {
      const pinnedMsgId = p.message?.id;
      return pinnedMsgId && Number(pinnedMsgId) === Number(msg.id);
    });
    return msg.isPinned || isPinnedInList;
  });

  const allUnpinned = selectedMessagesList.length > 0 && selectedMessagesList.every(msg => {
    const isPinnedInList = pinnedMessages.some(p => {
      const pinnedMsgId = p.message?.id;
      return pinnedMsgId && Number(pinnedMsgId) === Number(msg.id);
    });
    return !msg.isPinned && !isPinnedInList;
  });

  return (
    <div className={styles.container}>
      <ChatSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        currentChatId={chatId}
      />
      
      {sidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />}
      
      <div className={styles.mainContent}>
        {selectionMode ? (
          <SelectionHeader
            selectedCount={selectedMessages.size}
            onClose={exitSelectionMode}
            onSelectAll={handleSelectAll}
            onForward={() => handleForwardSelected(selectedMessages)}
            onPin={() => handlePinSelected(selectedMessages)}
            onUnpin={() => handleUnpinSelected(selectedMessages)}
            onDelete={() => handleDeleteSelected(selectedMessages)}
            canPin={!allPinned}
            canUnpin={!allUnpinned}
          />
        ) : (
          <ChatHeader
            chat={chat}
            user={user}
            searchOpen={searchOpen}
            searchText={searchText}
            isSearching={false}
            searchInputRef={searchInputRef}
            onOpenSearch={handleOpenSearch}
            onCloseSearch={handleCloseSearch}
            onSearchSubmit={handleSearchSubmit}
            onSearchTextChange={setSearchText}
            onMenuClick={() => {}}
          />
        )}
        
        {searchMode && searchText.trim() && (
          <div className={styles.searchResultsHeader}>
            <span className={styles.searchResultsCount}>
              {searchResults.length > 0 ? `${searchResults.length} найдено` : 'Ничего не найдено'}
            </span>
            <button
              type="button"
              onClick={handleCloseSearch}
              className={styles.searchCloseButton}
              title="Закрыть поиск"
            >
              ✕
            </button>
          </div>
        )}

        <PinnedMessagesHeader
          pinnedMessages={pinnedMessages}
          viewedPinnedMessageId={viewedPinnedMessageId}
          messages={messages}
          chatId={chatId}
          messagesContainerRef={messagesContainerRef}
          onUnpin={handleUnpinMessage}
          onViewedChange={setViewedPinnedMessageId}
          onNavigateToMessage={handleNavigateToMessage}
        />

        <MessageList
          messages={messages}
          loadingMore={loadingMore}
          messagesContainerRef={messagesContainerRef}
          onScroll={handleScrollThrottled}
          scrollButtonReady={scrollButtonReady}
          showScrollToBottom={showScrollToBottom}
          onScrollToBottom={scrollToBottom}
          unreadCount={unreadCount}
          user={user}
          selectionMode={selectionMode}
          selectedMessages={selectedMessages}
          toggleMessageSelection={toggleMessageSelection}
          handleSelectMessage={handleSelectMessage}
          handleContextMenu={handleContextMenu}
          getReadMetaForMessage={getReadMetaForMessage}
          getMessageStatusIcon={getMessageStatusIcon}
          pinnedMessages={pinnedMessages}
          searchOpen={searchOpen}
          searchText={searchText}
          searchMode={searchMode}
          searchResults={searchResults}
          newMessageIdsRef={newMessageIdsRef}
          loadedMessageIdsRef={loadedMessageIdsRef}
          setImageModal={setImageModal}
          setFileViewerModal={setFileViewerModal}
          handleNavigateToMessage={handleNavigateToMessage}
        />

        {voiceError && (
          <ErrorMessage>{voiceError}</ErrorMessage>
        )}

        <MessageInputArea
          newMessage={newMessage}
          editingMessageId={editingMessageId}
          editingContent={editingContent}
          replyingToMessage={replyingToMessage}
          selectedFile={selectedFile}
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
          onMessageChange={setNewMessage}
          onEditingContentChange={setEditingContent}
          onSendMessage={sendMessage}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          onCancelReply={handleCancelReply}
          onFileSelect={(e) => {
            const file = e?.target?.files?.[0];
            if (file) {
              if (file.type.startsWith('image/')) {
                if (selectedFileUrlRef.current) {
                  URL.revokeObjectURL(selectedFileUrlRef.current);
                }
                selectedFileUrlRef.current = URL.createObjectURL(file);
              }
              setSelectedFile(file);
            }
            if (e?.target) {
              e.target.value = '';
            }
          }}
          onRemoveFile={() => {
            if (selectedFileUrlRef.current) {
              URL.revokeObjectURL(selectedFileUrlRef.current);
              selectedFileUrlRef.current = null;
            }
            setSelectedFile(null);
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onKeyDown={handleKeyDown}
          onPauseRecording={pauseRecording}
          onResumeRecording={resumeRecording}
          onStopRecording={handleVoiceSendSimple}
          onCancelRecording={cancelRecording}
          onPlayPreview={handlePlayPreview}
          recordingTime={recordingTime}
          audioLevel={audioLevel}
        />
      </div>

      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          isOwn={contextMenu.message.senderId === user?.id}
          isPinned={pinnedMessages.some(p => {
            const pinnedMsgId = p.message?.id;
            return pinnedMsgId && Number(pinnedMsgId) === Number(contextMenu.message.id);
          })}
          onClose={handleCloseContextMenu}
          onReply={() => handleReplyMessage(contextMenu.message)}
          onPin={() => handlePinMessage(contextMenu.message)}
          onCopy={() => handleCopyMessage(contextMenu.message)}
          onForward={() => handleForwardMessage(contextMenu.message)}
          onDelete={() => handleDeleteMessage(contextMenu.message)}
          onEdit={() => handleEditMessage(contextMenu.message)}
          onSelect={() => handleSelectMessage(contextMenu.message)}
        />
      )}

      <DeleteConfirmModal
        deleteConfirm={deleteConfirm}
        deleteForAll={deleteForAll}
        messages={messages}
        user={user}
        chat={chat}
        onClose={() => { setDeleteConfirm(null); setDeleteForAll(false); }}
        onConfirm={handleConfirmDelete}
        onDeleteForAllChange={setDeleteForAll}
      />

      <ForwardModal
        forwardModal={forwardModal}
        chats={chats}
        chatId={chatId}
        user={user}
        onClose={() => setForwardModal(null)}
        onConfirm={handleConfirmForward}
        onChatSelect={(chatId) => setForwardModal(prev => ({ ...prev, selectedChatId: chatId }))}
        onCommentChange={(comment) => setForwardModal(prev => ({ ...prev, comment }))}
      />

      {imageModal && (
        <ImageModal
          imageUrl={imageModal.imageUrl}
          fileUrl={imageModal.fileUrl}
          onClose={() => setImageModal(null)}
        />
      )}

      {fileViewerModal && (
        <FileViewerModal
          fileUrl={fileViewerModal.fileUrl}
          fileName={fileViewerModal.fileName}
          mimeType={fileViewerModal.mimeType}
          onClose={() => setFileViewerModal(null)}
        />
      )}
    </div>
  );
};

export default ChatPresenter;

