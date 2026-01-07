import React, { useMemo } from 'react';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { formatChatDate, formatChatTime } from '@/utils/dateHelpers';
import VoiceMessagePlayer from '@/component/VoiceMessagePlayer';
import ImageMessage from '@/component/ImageMessage';
import FileMessage from '@/component/FileMessage';
import { Pin } from 'lucide-react';
import ForwardedMessage from './ForwardedMessage';
import ReplyMessage from './ReplyMessage';
import {
  shouldShowDate,
  isSearchMatch as checkSearchMatch,
  getMessageStatus,
  isPinnedInList,
  getMessageClasses,
  highlightSearchText
} from './utils';
import { messageRowComparison } from './memoComparison';
import styles from '@/styles/chat.module.css';

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
  const showDate = useMemo(() => {
    return shouldShowDate(index, msg, visibleMessages);
  }, [index, msg.createdAt, visibleMessages]);

  const isSearchMatch = useMemo(() => {
    return checkSearchMatch(searchOpen, searchText, msg.content);
  }, [searchOpen, searchText, msg.content]);

  const status = useMemo(() => {
    return getMessageStatus(msg);
  }, [msg.status, msg.isOptimistic]);

  const readMeta = useMemo(() => {
    return status === MESSAGE_STATUS.SENT ? getReadMetaForMessage(msg) : null;
  }, [status, msg, getReadMetaForMessage]);

  const isPinnedInListValue = useMemo(() => {
    return isPinnedInList(pinnedMessages, msg.id);
  }, [pinnedMessages, msg.id]);

  const isPinned = useMemo(() => {
    return msg.isPinned || isPinnedInListValue;
  }, [msg.isPinned, isPinnedInListValue]);

  const statusIcon = useMemo(() => {
    if (isOwn && !msg.deletedForMe && !msg.deletedForAll) {
      return getMessageStatusIcon(status, readMeta);
    }
    return null;
  }, [isOwn, msg.deletedForMe, msg.deletedForAll, status, readMeta, getMessageStatusIcon]);

  const messageClasses = useMemo(() => {
    return getMessageClasses(styles, {
      isOwn,
      isPinned,
      selectionMode,
      selectedMessages,
      msgId: msg.id,
      isOptimistic: msg.isOptimistic,
      isSearchMatch,
      newMessageIdsRef,
      loadedMessageIdsRef
    });
  }, [isOwn, isPinned, selectionMode, selectedMessages, msg.id, msg.isOptimistic, isSearchMatch, newMessageIdsRef, loadedMessageIdsRef]);

  const highlightedContent = useMemo(() => {
    if (!isSearchMatch || !searchText) return msg.content;
    return highlightSearchText(msg.content, searchText, styles);
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
                <ForwardedMessage 
                  forwardedFrom={msg.forwardedFrom}
                  senderId={msg.senderId}
                />
              )}
              {msg.replyTo && (
                <ReplyMessage 
                  replyTo={msg.replyTo}
                  onNavigate={handleNavigateToMessage}
                />
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
}, messageRowComparison);

MessageRow.displayName = 'MessageRow';

export default MessageRow;
