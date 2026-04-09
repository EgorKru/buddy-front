import { useEffect, useState } from 'react';
import { UserPlus, UserMinus, X } from 'lucide-react';
import styles from './index.module.css';

const RoomToast = ({ notifications, onDismiss }) => {
  return (
    <div className={styles.toastContainer}>
      {notifications.map((notification) => (
        <ToastItem
          key={notification.id}
          notification={notification}
          onDismiss={() => onDismiss(notification.id)}
        />
      ))}
    </div>
  );
};

const ToastItem = ({ notification, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onDismiss, 300);
    }, 2500);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  };

  const isJoin = notification.type === 'join';
  const Icon = isJoin ? UserPlus : UserMinus;

  return (
    <div
      className={`${styles.toast} ${isExiting ? styles.exiting : ''} ${isJoin ? styles.joinToast : styles.leaveToast}`}
    >
      <div className={styles.iconWrapper}>
        <Icon size={18} />
      </div>
      <div className={styles.content}>
        <span className={styles.name}>{notification.userName}</span>
        <span className={styles.action}>
          {isJoin ? 'присоединился к встрече' : 'покинул встречу'}
        </span>
      </div>
      <button className={styles.closeButton} onClick={handleDismiss}>
        <X size={14} />
      </button>
    </div>
  );
};

export default RoomToast;
