import { Loader2, ChevronDown } from 'lucide-react';
import { useEffect, useRef } from 'react';
import MessageRow from '@/component/MessageRow';
import styles from '@/styles/chat.module.css';
import { useMessageReadTracking } from '@/hooks/useMessageReadTracking';

export default function MessageList({
  messages,
  loadingMore,
  messagesContainerRef,
  onScroll,
  scrollButtonReady,
  showScrollToBottom,
  onScrollToBottom,
  unreadCount,
  user,
  selectionMode,
  selectedMessages,
  toggleMessageSelection,
  handleSelectMessage,
  handleContextMenu,
  getReadMetaForMessage,
  getMessageStatusIcon,
  pinnedMessages,
  searchOpen,
  searchText,
  searchMode,
  searchResults,
  newMessageIdsRef,
  loadedMessageIdsRef,
  setImageModal,
  setFileViewerModal,
  handleNavigateToMessage,
  chats,
  chatId  // Добавляем chatId в пропсы
}) {
  const { observeMessage, unobserveMessage } = useMessageReadTracking(chatId, true);
  const visibleMessages = (() => {
    
    if (searchMode && searchResults && searchResults.length > 0) {
      const resultIds = new Set(searchResults.map(r => String(r.id)));
      return searchResults.filter(msg => {
        if (!msg || !msg.id) return false;
        const isDeleted = msg.deletedForMe === true || msg.deletedForAll === true;
        return !isDeleted;
      });
    }

    return messages.filter(msg => {
      if (!msg || !msg.id) return false;
      const isDeleted = msg.deletedForMe === true || msg.deletedForAll === true;
      return !isDeleted;
    });
  })();

  useEffect(() => {
    if (!selectionMode) return;

    const handleSelectStart = (e) => {
      e.preventDefault();
      return false;
    };

    const handleSelect = () => {
      if (window.getSelection) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          selection.removeAllRanges();
        }
      }
    };

    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('selectstart', handleSelectStart);
      document.addEventListener('selectionchange', handleSelect);
      
      return () => {
        container.removeEventListener('selectstart', handleSelectStart);
        document.removeEventListener('selectionchange', handleSelect);
      };
    }
  }, [selectionMode, messagesContainerRef]);

  return (
    <>
      <div
        ref={messagesContainerRef}
        className={`${styles.messagesContainer} ${selectionMode ? styles.selectionMode : ''}`}
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
                  handleSelectMessage={handleSelectMessage}
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
                  chats={chats}
                  observeMessage={observeMessage}
                  unobserveMessage={unobserveMessage}
                />
              );
            })}
          </div>
        )}
      </div>
      
      {scrollButtonReady && (showScrollToBottom || unreadCount > 0) && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onScrollToBottom('smooth');
          }}
          className={styles.scrollToBottomButton}
          title={unreadCount > 0 ? `${unreadCount} новых сообщений` : "Прокрутить к новым сообщениям"}
        >
          <ChevronDown size={20} />
          {unreadCount > 0 && (
            <span className={styles.scrollToBottomBadge}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}

