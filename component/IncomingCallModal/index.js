import { useEffect, useState } from "react";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import styles from "./index.module.css";

const IncomingCallModal = ({ call, onAccept, onReject, onBusy }) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Таймер звонка
  useEffect(() => {
    if (!call) return;
    
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    // Авто-пропуск после 30 секунд
    const timeout = setTimeout(() => {
      onBusy?.(call.id);
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      setElapsedTime(0);
    };
  }, [call, onBusy]);

  if (!call) return null;

  const caller = call.caller;
  const callerName = caller?.displayName || caller?.username || `User ${caller?.id}`;
  const isVideo = call.type === 'VIDEO';

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Анимированные круги */}
        <div className={styles.pulseRings}>
          <div className={styles.ring1}></div>
          <div className={styles.ring2}></div>
          <div className={styles.ring3}></div>
        </div>

        {/* Аватар */}
        <div className={styles.avatarContainer}>
          <div className={styles.avatar}>
            {getInitials(callerName)}
          </div>
        </div>

        {/* Информация */}
        <div className={styles.info}>
          <h2 className={styles.callerName}>{callerName}</h2>
          <p className={styles.callType}>
            {isVideo ? (
              <>
                <Video size={16} />
                <span>Видеозвонок</span>
              </>
            ) : (
              <>
                <Phone size={16} />
                <span>Аудиозвонок</span>
              </>
            )}
          </p>
          <p className={styles.timer}>Звонит {elapsedTime} сек...</p>
        </div>

        {/* Кнопки */}
        <div className={styles.actions}>
          <button 
            className={styles.rejectButton}
            onClick={() => onReject?.(call.id)}
            title="Отклонить"
          >
            <PhoneOff size={28} />
          </button>
          
          <button 
            className={styles.acceptButton}
            onClick={() => onAccept?.(call.id)}
            title="Принять"
          >
            {isVideo ? <Video size={28} /> : <Phone size={28} />}
          </button>
        </div>

        {/* Кнопка "Занят" */}
        <button 
          className={styles.busyButton}
          onClick={() => onBusy?.(call.id)}
        >
          Ответить позже
        </button>
      </div>
    </div>
  );
};

IncomingCallModal.displayName = 'IncomingCallModal';

export default IncomingCallModal;
