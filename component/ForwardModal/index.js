import { getChatName } from '@/utils/chatHelpers';
import styles from '@/styles/chat.module.css';

export default function ForwardModal({
  forwardModal,
  chats,
  chatId,
  user,
  onClose,
  onConfirm,
  onChatSelect,
  onCommentChange,
}) {
  if (!forwardModal) return null;

  return (
    <div className={styles.forwardModalOverlay} onClick={onClose}>
      <div className={styles.forwardModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.forwardModalTitle}>
          {forwardModal.messageIds && forwardModal.messageIds.length > 1
            ? `Переслать ${forwardModal.messageIds.length} сообщений`
            : 'Переслать сообщение'}
        </h3>

        <div className={styles.forwardModalSection}>
          <label className={styles.forwardModalLabel}>Выберите чат:</label>
          <div className={styles.forwardModalChatList}>
            {chats
              .filter((c) => String(c.id) !== String(chatId))
              .map((c) => (
                <button
                  key={c.id}
                  className={`${styles.forwardModalChatItem} ${forwardModal.selectedChatId === c.id ? styles.forwardModalChatItemSelected : ''}`}
                  onClick={() => onChatSelect(c.id)}
                >
                  <div className={styles.forwardModalChatName}>{getChatName(c, user)}</div>
                </button>
              ))}
            {chats.filter((c) => String(c.id) !== String(chatId)).length === 0 && (
              <div className={styles.forwardModalEmpty}>Нет других чатов для пересылки</div>
            )}
          </div>
        </div>

        <div className={styles.forwardModalSection}>
          <label className={styles.forwardModalLabel}>Комментарий (необязательно):</label>
          <textarea
            className={styles.forwardModalComment}
            placeholder="Добавьте комментарий..."
            value={forwardModal.comment || ''}
            onChange={(e) => onCommentChange(e.target.value)}
            rows={3}
          />
        </div>

        <div className={styles.forwardModalButtons}>
          <button className={styles.forwardModalCancel} onClick={onClose}>
            Отмена
          </button>
          <button
            className={styles.forwardModalConfirm}
            onClick={onConfirm}
            disabled={!forwardModal.selectedChatId}
          >
            Переслать
          </button>
        </div>
      </div>
    </div>
  );
}
