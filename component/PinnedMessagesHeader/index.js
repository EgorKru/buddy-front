import { Mic, X, Image as ImageIcon, File } from 'lucide-react';
import { chatAPI } from '@/utils/api';
import styles from '@/styles/chat.module.css';

export default function PinnedMessagesHeader({
  pinnedMessages,
  viewedPinnedMessageId,
  messages,
  chatId,
  messagesContainerRef,
  onUnpin,
  onViewedChange,
  onNavigateToMessage,
}) {
  if (pinnedMessages.length === 0) return null;

  const visiblePinnedMessages = pinnedMessages.filter((p) => {
    const msgId = p.message?.id;
    if (!msgId) return false;
    const msg = messages.find((m) => Number(m.id) === Number(msgId));
    if (msg && (msg.deletedForMe || msg.deletedForAll)) {
      return false;
    }
    return true;
  });

  if (visiblePinnedMessages.length === 0) return null;

  let messageToShow = null;

  if (viewedPinnedMessageId) {
    const viewedIndex = visiblePinnedMessages.findIndex((p) => {
      const msgId = p.message?.id;
      return msgId && Number(msgId) === Number(viewedPinnedMessageId);
    });
    if (viewedIndex >= 0 && viewedIndex < visiblePinnedMessages.length - 1) {
      messageToShow = visiblePinnedMessages[viewedIndex + 1];
    } else {
      messageToShow = visiblePinnedMessages[0];
    }
  } else {
    messageToShow = visiblePinnedMessages[0];
  }

  if (!messageToShow) return null;

  const msg = messageToShow.message || messageToShow;

  const handleClick = async () => {
    if (onNavigateToMessage) {
      await onNavigateToMessage(msg.id);
      onViewedChange(msg.id);
    } else {
      const targetMessage = document.querySelector(`[data-message-id="${msg.id}"]`);
      if (targetMessage) {
        targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetMessage.classList.add(styles.messageHighlight);
        setTimeout(() => {
          targetMessage.classList.remove(styles.messageHighlight);
        }, 2000);
        onViewedChange(msg.id);
      } else {
        try {
          await chatAPI.getMessage(chatId, msg.id);
          messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          onViewedChange(msg.id);
        } catch (error) {}
      }
    }
  };

  return (
    <div className={styles.pinnedMessagesContainer}>
      <div key={messageToShow.id || msg.id} className={styles.pinnedMessage} onClick={handleClick}>
        <div className={styles.pinnedMessageLine} />
        <div className={styles.pinnedMessageContent}>
          <div className={styles.pinnedMessageHeader}>
            <span className={styles.pinnedMessageLabel}>Закреплённое сообщение</span>
            <button
              className={styles.pinnedMessageUnpin}
              onClick={(e) => {
                e.stopPropagation();
                onUnpin(messageToShow);
              }}
              title="Открепить"
            >
              <X size={14} />
            </button>
          </div>
          <div className={styles.pinnedMessageText}>
            {msg.type === 'VOICE' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mic size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
                <span>
                  Голосовое сообщение {msg.duration ? `(${Math.round(msg.duration)}с)` : ''}
                </span>
              </div>
            ) : msg.type === 'IMAGE' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
                <span>{msg.content || '📷 Фото'}</span>
              </div>
            ) : msg.type === 'FILE' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <File size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
                <span>{msg.content || '📎 Файл'}</span>
              </div>
            ) : (
              msg.content || ''
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
