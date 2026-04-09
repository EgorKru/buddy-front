import { getForwardedContentPreview } from './utils';
import styles from '@/styles/chat.module.css';

export default function ForwardedMessage({ forwardedFrom, senderId, chats, user }) {
  const getChatName = (chatId) => {
    if (!chats || !chatId) return null;
    const chat = chats.find((c) => String(c.id) === String(chatId));
    if (!chat) return null;

    if (chat.type === 'DIRECT') {
      const otherParticipant = chat.participants?.find(
        (p) => String(p.userId) !== String(user?.id)
      );
      return otherParticipant?.displayName || otherParticipant?.username || 'Пользователь';
    }
    return chat.name || 'Чат';
  };

  const originalChatName = forwardedFrom.originalChatId
    ? getChatName(forwardedFrom.originalChatId)
    : null;

  return (
    <div className={styles.messageForwarded}>
      <div className={styles.messageForwardedHeader}>
        <span className={styles.messageForwardedIcon}>↪</span>
        <span className={styles.messageForwardedText}>
          Переслано от{' '}
          {forwardedFrom.originalSenderDisplayName || forwardedFrom.originalSenderUsername}
          {originalChatName && <span> из {originalChatName}</span>}
          {forwardedFrom.forwardedByUserId !== senderId && (
            <span>
              {' '}
              • Переслал {forwardedFrom.forwardedByDisplayName || forwardedFrom.forwardedByUsername}
            </span>
          )}
        </span>
      </div>
      <div className={styles.messageForwardedContent}>
        {getForwardedContentPreview(
          forwardedFrom.originalType,
          forwardedFrom.originalContent,
          forwardedFrom.originalEncryptionVersion
        )}
      </div>
    </div>
  );
}
