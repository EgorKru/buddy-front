import { X, Forward, Pin, PinOff, Trash2 } from 'lucide-react';
import styles from '@/styles/chat.module.css';

export default function SelectionHeader({
  selectedCount,
  onClose,
  onSelectAll,
  onForward,
  onPin,
  onUnpin,
  onDelete,
  canPin,
  canUnpin,
}) {
  return (
    <div className={styles.selectionHeader}>
      <button
        className={styles.selectionCloseButton}
        onClick={onClose}
        title="Закрыть"
      >
        <X size={20} />
      </button>
      <div className={styles.selectionInfo}>
        <span className={styles.selectionCount}>Выбрано: {selectedCount}</span>
      </div>
      <div className={styles.selectionActions}>
        <button
          className={styles.selectionActionButton}
          onClick={onSelectAll}
          title="Выбрать все"
        >
          Выбрать все
        </button>
        <button
          className={styles.selectionActionButton}
          onClick={onForward}
          title="Переслать"
        >
          <Forward size={16} />
        </button>
        {canPin && (
          <button
            className={styles.selectionActionButton}
            onClick={onPin}
            title="Закрепить"
          >
            <Pin size={16} />
          </button>
        )}
        {canUnpin && (
          <button
            className={styles.selectionActionButton}
            onClick={onUnpin}
            title="Открепить"
          >
            <PinOff size={16} />
          </button>
        )}
        <button
          className={`${styles.selectionActionButton} ${styles.selectionActionButtonDanger}`}
          onClick={onDelete}
          title="Удалить"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

