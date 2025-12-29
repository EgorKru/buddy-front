import { useState, useEffect } from 'react';
import { X, Bell } from 'lucide-react';
import styles from '@/component/PagerNotification/index.module.css';
import Pager3D from '@/component/Pager3D';

/**
 * Компонент уведомлений в виде пейджера
 * @param {Object} props
 * @param {Array} props.notifications - Массив уведомлений
 * @param {Function} props.onNotificationClick - Обработчик клика по уведомлению
 * @param {Function} props.onDismiss - Обработчик закрытия уведомления
 */
export default function PagerNotification({ 
  notifications = [], 
  onNotificationClick,
  onDismiss 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState(null);

  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
    
    if (notifications.length > 0) {
      const latest = notifications
        .filter(n => !n.read)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      setLatestNotification(latest || notifications[notifications.length - 1]);
    }
  }, [notifications]);

  const handlePagerClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleNotificationClick = (notification) => {
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    setIsExpanded(false);
  };

  const handleDismiss = (e, notificationId) => {
    e.stopPropagation();
    if (onDismiss) {
      onDismiss(notificationId);
    }
  };

  if (notifications.length === 0 && !latestNotification) {
    return null;
  }

  return (
    <div className={styles.pagerNotificationContainer}>
      <div 
        className={`${styles.pagerWrapper} ${isExpanded ? styles.expanded : ''}`}
        onClick={handlePagerClick}
      >
        <div className={styles.pager3dWrapper}>
          <Pager3D size={60} interactive={true} />
          {unreadCount > 0 && (
            <div className={styles.unreadBadge}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </div>
        
        {latestNotification && !isExpanded && (
          <div className={styles.notificationPreview}>
            <div className={styles.notificationIcon}>
              <Bell size={14} />
            </div>
            <div className={styles.notificationText}>
              <div className={styles.notificationTitle}>
                {latestNotification.title || 'Новое сообщение'}
              </div>
              <div className={styles.notificationContent}>
                {latestNotification.content?.substring(0, 30)}
                {latestNotification.content?.length > 30 ? '...' : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className={styles.notificationsList}>
          <div className={styles.listHeader}>
            <h3>Уведомления</h3>
            <button 
              className={styles.closeButton}
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
            >
              <X size={18} />
            </button>
          </div>
          
          <div className={styles.listContent}>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <Bell size={24} />
                <p>Нет уведомлений</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`${styles.notificationItem} ${!notification.read ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={styles.notificationItemContent}>
                    <div className={styles.notificationItemTitle}>
                      {notification.title || 'Уведомление'}
                    </div>
                    <div className={styles.notificationItemText}>
                      {notification.content}
                    </div>
                    <div className={styles.notificationItemTime}>
                      {new Date(notification.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <button
                    className={styles.dismissButton}
                    onClick={(e) => handleDismiss(e, notification.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

