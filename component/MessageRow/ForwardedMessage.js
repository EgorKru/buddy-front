import { useMemo } from 'react';
import { useMessageTextPreview } from '@/hooks/useMessageTextPreview';
import { getForwardedContentPreview } from './utils';
import styles from '@/styles/chat.module.css';

export default function ForwardedMessage({ forwardedFrom, senderId, chats, user }) {
  const originalMessage = useMemo(
    () => ({
      type: forwardedFrom.originalType,
      content: forwardedFrom.originalContent,
      encryptionVersion: forwardedFrom.originalEncryptionVersion,
      senderId: forwardedFrom.originalSenderId,
    }),
    [forwardedFrom]
  );

  const originalChat = useMemo(() => {
    if (!chats || !forwardedFrom.originalChatId) return null;
    return chats.find((c) => String(c.id) === String(forwardedFrom.originalChatId)) ?? null;
  }, [chats, forwardedFrom.originalChatId]);

  const decryptedPreview = useMessageTextPreview(
    Number(forwardedFrom.originalEncryptionVersion) > 0 ? originalMessage : null,
    originalChat,
    user
  );

  const preview =
    Number(forwardedFrom.originalEncryptionVersion) > 0
      ? decryptedPreview
      : getForwardedContentPreview(
          forwardedFrom.originalType,
          forwardedFrom.originalContent,
          forwardedFrom.originalEncryptionVersion
        );
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
      <div className={styles.messageForwardedContent}>{preview}</div>
    </div>
  );
}
