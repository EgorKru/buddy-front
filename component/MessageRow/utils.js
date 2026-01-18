import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { formatChatDate } from '@/utils/dateHelpers';

export const shouldShowDate = (index, msg, visibleMessages) => {
  return index === 0 ||
    formatChatDate(visibleMessages[index - 1]?.createdAt) !== formatChatDate(msg.createdAt);
};

export const isSearchMatch = (searchOpen, searchText, content) => {
  return searchOpen && searchText && content && 
    content.toLowerCase().includes(searchText.toLowerCase());
};

export const getMessageStatus = (msg) => {
  return msg.status || (msg.isOptimistic ? MESSAGE_STATUS.SENDING : MESSAGE_STATUS.SENT);
};

export const isPinnedInList = (pinnedMessages, msgId) => {
  return pinnedMessages.some(p => {
    const pinnedMsgId = p.message?.id;
    return pinnedMsgId && Number(pinnedMsgId) === Number(msgId);
  });
};

export const getMessageClasses = (styles, {
  isOwn,
  isPinned,
  selectionMode,
  selectedMessages,
  msgId,
  isOptimistic,
  isSearchMatch,
  newMessageIdsRef,
  loadedMessageIdsRef
}) => {
  return `${styles.message} ${isOwn ? styles.ownMessage : ''} ${isPinned ? styles.messagePinned : ''} ${selectionMode ? styles.selectionMode : ''} ${selectionMode && selectedMessages.has(msgId) ? styles.messageSelected : ''} ${newMessageIdsRef.current.has(String(msgId)) || isOptimistic ? styles.messageNew : ''} ${loadedMessageIdsRef.current.has(String(msgId)) ? styles.messageLoaded : ''} ${isSearchMatch ? styles.messageSearchMatch : ''}`;
};

export const highlightSearchText = (content, searchText, styles) => {
  if (!searchText) return content;
  
  const escapedSearchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedSearchText})`, 'gi');
  const parts = content.split(regex);
  return parts.map((part, i) => 
    part.toLowerCase() === searchText.toLowerCase() ? (
      <mark key={i} className={styles.searchHighlight}>{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};

export const getForwardedContentPreview = (originalType, originalContent) => {
  if (originalType === 'VOICE') return '🎤 Голосовое сообщение';
  if (originalType === 'IMAGE') return '📷 Фото';
  if (originalType === 'FILE') return '📎 Файл';
  return originalContent;
};

export const getReplyContentPreview = (replyTo) => {
  if (replyTo.type === 'VOICE') return '🎤 Голосовое сообщение';
  if (replyTo.type === 'IMAGE') return '📷 Фото';
  if (replyTo.type === 'FILE') return '📎 Файл';
  return replyTo.content || '';
};

