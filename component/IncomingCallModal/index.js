import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, X } from 'lucide-react';
import styles from './index.module.css';

const IncomingCallModal = ({ call, onAccept, onReject, onBusy }) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!call) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

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
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className={styles.overlay} data-testid="incoming-call-modal">
      <div className={styles.modal}>
        {}
        <div className={styles.pulseRings}>
          <div className={styles.ring1}></div>
          <div className={styles.ring2}></div>
          <div className={styles.ring3}></div>
        </div>

        {}
        <div className={styles.avatarContainer}>
          <div className={styles.avatar}>{getInitials(callerName)}</div>
        </div>

        {}
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

        {}
        <div className={styles.actions}>
          <button
            className={styles.rejectButton}
            data-testid="incoming-call-reject"
            onClick={() => onReject?.(call.id)}
            title="Отклонить"
          >
            <PhoneOff size={28} />
          </button>

          <button
            className={styles.acceptButton}
            data-testid="incoming-call-accept"
            onClick={() => onAccept?.(call.id)}
            title="Принять"
          >
            {isVideo ? <Video size={28} /> : <Phone size={28} />}
          </button>
        </div>

        {}
        <button className={styles.busyButton} onClick={() => onBusy?.(call.id)}>
          Ответить позже
        </button>
      </div>
    </div>
  );
};

IncomingCallModal.displayName = 'IncomingCallModal';

export default IncomingCallModal;
