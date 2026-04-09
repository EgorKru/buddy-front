import { Edit, Reply, X } from 'lucide-react';
import styles from '@/styles/chat.module.css';

export function EditReplyBar({ editingMessageId, replyingToMessage, onCancelEdit, onCancelReply }) {
  return (
    <>
      {editingMessageId && (
        <div className={styles.editIndicator}>
          <Edit size={14} strokeWidth={1.5} />
          <span>Редактирование</span>
          <button
            type="button"
            onClick={onCancelEdit}
            className={styles.cancelEditButton}
            title="Отменить редактирование"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {replyingToMessage && (
        <div className={styles.replyIndicator}>
          <Reply size={16} strokeWidth={1.5} />
          <div className={styles.replyIndicatorContent}>
            <div className={styles.replyIndicatorAuthor}>
              В ответ {replyingToMessage.senderDisplayName || replyingToMessage.senderUsername}
            </div>
            <div className={styles.replyIndicatorText}>
              {replyingToMessage.type === 'VOICE'
                ? '🎤 Голосовое сообщение'
                : replyingToMessage.type === 'IMAGE'
                  ? '📷 Фото'
                  : replyingToMessage.type === 'FILE'
                    ? '📎 Файл'
                    : replyingToMessage.content || ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className={styles.cancelReplyButton}
            title="Отменить ответ"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </>
  );
}
