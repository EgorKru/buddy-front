import React, { useMemo } from 'react';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { formatChatDate, formatChatTime } from '@/utils/dateHelpers';
import VoiceMessagePlayer from '@/component/VoiceMessagePlayer';
import ImageMessage from '@/component/ImageMessage';
import FileMessage from '@/component/FileMessage';
import { Pin, Clock, Check, CheckCheck } from 'lucide-react';
import styles from '@/styles/chat.module.css';

// Оптимизированный компонент строки сообщения с React.memo
const MessageRow = React.memo(({ 
  msg, 
  index, 
  visibleMessages, 
  user, 
  isOwn, 
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
  handleNavigateToMessage 
}) => {
  // Мемоизация тяжелых вычислений
  const showDate = useMemo(() => {
    return index === 0 ||
      formatChatDate(visibleMessages[index - 1]?.createdAt) !== formatChatDate(msg.createdAt);
  }, [index, msg.createdAt, visibleMessages]);

  const isSearchMatch = useMemo(() => {
    return searchOpen && searchText && msg.content && 
      msg.content.toLowerCase().includes(searchText.toLowerCase());
  }, [searchOpen, searchText, msg.content]);

  const status = useMemo(() => {
    return msg.status || (msg.isOptimistic ? MESSAGE_STATUS.SENDING : MESSAGE_STATUS.SENT);
  }, [msg.status, msg.isOptimistic]);

  const readMeta = useMemo(() => {
    return status === MESSAGE_STATUS.SENT ? getReadMetaForMessage(msg) : null;
  }, [status, msg, getReadMetaForMessage]);

  const isPinnedInList = useMemo(() => {
    return pinnedMessages.some(p => {
      const pinnedMsgId = p.message?.id;
      return pinnedMsgId && Number(pinnedMsgId) === Number(msg.id);
    });
  }, [pinnedMessages, msg.id]);

  const isPinned = useMemo(() => {
    return msg.isPinned || isPinnedInList;
  }, [msg.isPinned, isPinnedInList]);

  const statusIcon = useMemo(() => {
    if (isOwn && !msg.deletedForMe && !msg.deletedForAll) {
      return getMessageStatusIcon(status, readMeta);
    }
    return null;
  }, [isOwn, msg.deletedForMe, msg.deletedForAll, status, readMeta, getMessageStatusIcon]);

  const messageClasses = useMemo(() => {
    return `${styles.message} ${isOwn ? styles.ownMessage : ''} ${isPinned ? styles.messagePinned : ''} ${selectionMode && selectedMessages.has(msg.id) ? styles.messageSelected : ''} ${newMessageIdsRef.current.has(String(msg.id)) || msg.isOptimistic ? styles.messageNew : ''} ${loadedMessageIdsRef.current.has(String(msg.id)) ? styles.messageLoaded : ''} ${isSearchMatch ? styles.messageSearchMatch : ''}`;
  }, [isOwn, isPinned, selectionMode, selectedMessages, msg.id, msg.isOptimistic, isSearchMatch]);

  // Обработка поиска с подсветкой
  const highlightedContent = useMemo(() => {
    if (!isSearchMatch || !searchText) return msg.content;
    
    const escapedSearchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchText})`, 'gi');
    const parts = msg.content.split(regex);
    return parts.map((part, i) => 
      part.toLowerCase() === searchText.toLowerCase() ? (
        <mark key={i} className={styles.searchHighlight}>{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }, [isSearchMatch, searchText, msg.content]);

  return (
    <div key={msg.id}>
      {showDate && (
        <div className={styles.dateDivider}>
          {formatChatDate(msg.createdAt)}
        </div>
      )}
      <div
        className={messageClasses}
        onContextMenu={(e) => !selectionMode && handleContextMenu(e, msg)}
        onClick={() => selectionMode && toggleMessageSelection(msg.id)}
        data-message-id={msg.id}
      >
        {selectionMode && (
          <div className={styles.messageCheckbox}>
            <input
              type="checkbox"
              checked={selectedMessages.has(msg.id)}
              onChange={() => {}}
              onClick={(e) => {
                e.stopPropagation();
                toggleMessageSelection(msg.id);
              }}
            />
          </div>
        )}
        {!isOwn && (
          <div className={styles.messageAvatar}>
            {msg.senderDisplayName?.[0] || msg.senderUsername?.[0] || '?'}
          </div>
        )}
        <div className={styles.messageContent}>
          {!isOwn && (
            <div className={styles.messageHeader}>
              <span className={styles.senderName}>
                {msg.senderDisplayName || msg.senderUsername}
              </span>
            </div>
          )}
          {msg.type === 'VOICE' && msg.fileUrl ? (
            <VoiceMessagePlayer 
              fileUrl={msg.fileUrl} 
              duration={msg.duration}
              messageTime={formatChatTime(msg.createdAt)}
              isOwn={isOwn}
              statusIcon={statusIcon}
              isPinned={isPinned}
            />
          ) : msg.type === 'IMAGE' && msg.fileUrl ? (
            <ImageMessage
              fileUrl={msg.fileUrl}
              content={msg.content}
              messageTime={formatChatTime(msg.createdAt)}
              isOwn={isOwn}
              statusIcon={statusIcon}
              isPinned={isPinned}
              onImageClick={(imageUrl, fileUrl) => {
                setImageModal({ imageUrl, fileUrl });
              }}
            />
          ) : msg.type === 'FILE' && msg.fileUrl ? (
            <FileMessage
              fileUrl={msg.fileUrl}
              content={msg.content}
              fileSize={msg.fileSize}
              mimeType={msg.mimeType}
              messageTime={formatChatTime(msg.createdAt)}
              isOwn={isOwn}
              statusIcon={statusIcon}
              isPinned={isPinned}
              fileName={msg.fileName}
            />
          ) : (
            <div className={`${styles.messageText} ${msg.isOptimistic ? styles.messagePending : ''} ${msg.status === MESSAGE_STATUS.FAILED ? styles.messageFailed : ''}`}>
              {msg.forwardedFrom && (
                <div className={styles.messageForwarded}>
                  <div className={styles.messageForwardedHeader}>
                    <span className={styles.messageForwardedIcon}>↪</span>
                    <span className={styles.messageForwardedText}>
                      Переслано от {msg.forwardedFrom.originalSenderDisplayName || msg.forwardedFrom.originalSenderUsername}
                      {msg.forwardedFrom.forwardedByUserId !== msg.senderId && (
                        <span> • Переслал {msg.forwardedFrom.forwardedByDisplayName || msg.forwardedFrom.forwardedByUsername}</span>
                      )}
                    </span>
                  </div>
                  {msg.forwardedFrom.originalType === 'VOICE' ? (
                    <div className={styles.messageForwardedContent}>
                      🎤 Голосовое сообщение
                    </div>
                  ) : msg.forwardedFrom.originalType === 'IMAGE' ? (
                    <div className={styles.messageForwardedContent}>
                      📷 Фото
                    </div>
                  ) : msg.forwardedFrom.originalType === 'FILE' ? (
                    <div className={styles.messageForwardedContent}>
                      📎 Файл
                    </div>
                  ) : (
                    <div className={styles.messageForwardedContent}>
                      {msg.forwardedFrom.originalContent}
                    </div>
                  )}
                </div>
              )}
              {msg.replyTo && (
                <div 
                  className={styles.messageReply}
                  onClick={async (e) => {
                    e.stopPropagation();
                    handleNavigateToMessage(msg.replyTo.id);
                  }}
                >
                  <div className={styles.messageReplyContent}>
                    <div className={styles.messageReplyAuthor}>
                      {msg.replyTo.senderDisplayName || msg.replyTo.senderUsername}
                    </div>
                    <div className={styles.messageReplyText}>
                      {msg.replyTo.type === 'VOICE' ? '🎤 Голосовое сообщение' : 
                       msg.replyTo.type === 'IMAGE' ? '📷 Фото' :
                       msg.replyTo.type === 'FILE' ? '📎 Файл' :
                       msg.replyTo.content || ''}
                    </div>
                  </div>
                </div>
              )}
              <div className={styles.messageTextContentWrapper}>
                <div className={styles.messageTextContent}>
                  {highlightedContent}
                </div>
                <div className={styles.messageTextMeta}>
                  {isPinned && (
                    <Pin size={12} className={styles.messagePinnedIcon} title="Закреплено" />
                  )}
                  <span className={styles.messageTime}>
                    {formatChatTime(msg.createdAt)}
                  </span>
                  {msg.edited && (
                    <span className={styles.messageEdited} title={msg.editedAt ? `Отредактировано ${formatChatTime(msg.editedAt)}` : 'Отредактировано'}>
                      (ред.)
                    </span>
                  )}
                  {statusIcon && (
                    <span title={readMeta?.readCount
                      ? (readMeta.totalOthers > 1 ? `Прочитали ${readMeta.readCount}/${readMeta.totalOthers}` : 'Прочитано')
                      : 'Отправлено'}>
                      {statusIcon}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Кастомная логика сравнения для оптимизации
  const prevMsg = prevProps.msg;
  const nextMsg = nextProps.msg;
  
  // Сравниваем основные поля
  if (prevMsg.id !== nextMsg.id) return false;
  if (prevMsg.status !== nextMsg.status) return false;
  if (prevMsg.content !== nextMsg.content) return false;
  if (prevMsg.isOptimistic !== nextMsg.isOptimistic) return false;
  if (prevMsg.isPinned !== nextMsg.isPinned) return false;
  if (prevMsg.deletedForMe !== nextMsg.deletedForMe) return false;
  if (prevMsg.deletedForAll !== nextMsg.deletedForAll) return false;
  
  // Сравниваем состояние выбора
  if (prevProps.selectionMode !== nextProps.selectionMode) return false;
  if (prevProps.selectedMessages.has(prevMsg.id) !== nextProps.selectedMessages.has(nextMsg.id)) return false;
  
  // Сравниваем поиск
  if (prevProps.searchOpen !== nextProps.searchOpen) return false;
  if (prevProps.searchText !== nextProps.searchText) return false;
  
  // Сравниваем закрепленные сообщения
  if (prevProps.pinnedMessages.length !== nextProps.pinnedMessages.length) return false;
  
  return true; // Пропсы одинаковые, не перерисовываем
});

MessageRow.displayName = 'MessageRow';

export default MessageRow;

