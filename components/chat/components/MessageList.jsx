import { Loader2, ChevronDown } from 'lucide-react';
import MessageRow from '@/component/MessageRow';
import styles from '@/styles/chat.module.css';

export default function MessageList({
  messages,
  loadingMore,
  messagesContainerRef,
  onScroll,
  scrollButtonReady,
  showScrollToBottom,
  onScrollToBottom,
  user,
  selectionMode,
  selectedMessages,
  toggleMessageSelection,
  handleContextMenu,
  getReadMetaForMessage,
  getMessageStatusIcon,
  pinnedMessages,
  searchOpen,
  searchText,
  newMessageIdsRef,
  loadedMessageIdsRef,
  setImageModal,
  setFileViewerModal,
  handleNavigateToMessage
}) {
  const visibleMessages = messages.filter(msg => {
    if (!msg || !msg.id) return false;
    const isDeleted = msg.deletedForMe === true || msg.deletedForAll === true;
    return !isDeleted;
  });

  return (
    <>
      <div
        ref={messagesContainerRef}
        className={styles.messagesContainer}
        onScroll={onScroll}
      >
        {loadingMore && (
          <div className={styles.loadingMore}>
            <Loader2 size={16} className={styles.spinner} />
            <span>Загрузка старых сообщений...</span>
          </div>
        )}
        
        {visibleMessages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Пока нет сообщений</p>
            <p className={styles.emptyHint}>Начните общение!</p>
          </div>
        ) : (
          <div>
            {visibleMessages.map((msg, index) => {
              const isOwn = msg.senderId === user?.id;
              
              return (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  index={index}
                  visibleMessages={visibleMessages}
                  user={user}
                  isOwn={isOwn}
                  selectionMode={selectionMode}
                  selectedMessages={selectedMessages}
                  toggleMessageSelection={toggleMessageSelection}
                  handleContextMenu={handleContextMenu}
                  getReadMetaForMessage={getReadMetaForMessage}
                  getMessageStatusIcon={getMessageStatusIcon}
                  pinnedMessages={pinnedMessages}
                  searchOpen={searchOpen}
                  searchText={searchText}
                  newMessageIdsRef={newMessageIdsRef}
                  loadedMessageIdsRef={loadedMessageIdsRef}
                  setImageModal={setImageModal}
                  setFileViewerModal={setFileViewerModal}
                  handleNavigateToMessage={handleNavigateToMessage}
                />
              );
            })}
          </div>
        )}
      </div>
      
      {scrollButtonReady && (
        <button
          onClick={onScrollToBottom}
          className={`${styles.scrollToBottomButton} ${!showScrollToBottom ? styles.hidden : ''}`}
          title="Прокрутить к новым сообщениям"
        >
          <ChevronDown size={20} />
        </button>
      )}
    </>
  );
}

