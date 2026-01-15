import { Phone, Video, X } from "lucide-react";
import styles from "./index.module.css";

const CallTypeModal = ({ 
  isOpen, 
  onClose, 
  targetUser,
  onSelectAudio,
  onSelectVideo,
}) => {
  if (!isOpen) return null;

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const displayName = targetUser?.displayName || targetUser?.username || `User ${targetUser?.id}`;
  const initials = getInitials(displayName);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Аватар */}
        <div className={styles.avatarContainer}>
          <div className={styles.avatar}>
            {initials}
          </div>
        </div>

        {/* Имя */}
        <h2 className={styles.userName}>{displayName}</h2>

        {/* Инструкция */}
        <p className={styles.instruction}>
          Если Вы хотите начать видеозвонок, нажмите на значок камеры.
        </p>

        {/* Кнопки */}
        <div className={styles.actions}>
          <button
            className={styles.videoButton}
            onClick={() => {
              onSelectVideo?.();
              onClose();
            }}
            title="Видеозвонок"
          >
            <Video size={24} />
            <span>Вкл. видео</span>
          </button>

          <button
            className={styles.cancelButton}
            onClick={onClose}
            title="Отменить"
          >
            <X size={24} />
            <span>Отменить</span>
          </button>

          <button
            className={styles.audioButton}
            onClick={() => {
              onSelectAudio?.();
              onClose();
            }}
            title="Аудиозвонок"
          >
            <Phone size={24} />
            <span>Позвонить</span>
          </button>
        </div>
      </div>
    </div>
  );
};

CallTypeModal.displayName = 'CallTypeModal';

export default CallTypeModal;
