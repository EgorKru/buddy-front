import styles from '@/styles/chat.module.css';

export default function DeleteConfirmModal({
  deleteConfirm,
  deleteForAll,
  messages,
  user,
  chat,
  onClose,
  onConfirm,
  onDeleteForAllChange,
}) {
  if (!deleteConfirm) return null;

  const getOtherParticipantName = () => {
    if (!chat?.participants || !user?.id) return '';
    if (chat.type !== 'DIRECT') {
      return `${chat.participants?.length || 0} участников`;
    }
    const other = chat.participants.find((p) => Number(p.id) !== Number(user.id));
    return other?.displayName || other?.username || '';
  };

  const messageIds =
    deleteConfirm?.messageIds || (deleteConfirm?.message?.id ? [deleteConfirm.message.id] : []);
  const isMultiple = messageIds.length > 1;
  const otherParticipantName = getOtherParticipantName();
  const allOwnMessages = messageIds.every((id) => {
    const msg = messages.find((m) => Number(m.id) === Number(id));
    return msg?.senderId === user?.id;
  });
  const canDeleteForAll = allOwnMessages && messageIds.length > 0;

  return (
    <div className={styles.deleteModalOverlay} onClick={onClose}>
      <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.deleteModalTitle}>
          {isMultiple ? `Удалить ${messageIds.length} сообщений?` : 'Удалить это сообщение?'}
        </h3>
        {canDeleteForAll && otherParticipantName && (
          <label className={styles.deleteModalCheckbox}>
            <input
              type="checkbox"
              checked={deleteForAll}
              onChange={(e) => onDeleteForAllChange(e.target.checked)}
            />
            <span>Также удалить для {otherParticipantName}</span>
          </label>
        )}
        <div className={styles.deleteModalButtons}>
          <button className={styles.deleteModalCancel} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.deleteModalConfirm}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onConfirm && typeof onConfirm === 'function') {
                onConfirm();
              } else {
              }
            }}
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}
