import { useState, useEffect } from 'react';
import { X, Bell, Radio } from 'lucide-react';
import styles from '@/component/PagerNotification/index.module.css';
import { unlockPagerAudio } from '@/utils/pagerSound';

export default function PagerNotification({ 
  notifications = [], 
  onNotificationClick,
  onDismiss 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState(null);

  const unreadNotifications = notifications.filter(n => !n.read);

  useEffect(() => {
    const unread = unreadNotifications.length;
    setUnreadCount(unread);
    
    if (unreadNotifications.length > 0) {
      const latest = unreadNotifications
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      setLatestNotification(latest);
    } else {
      // Если все уведомления прочитаны, скрываем плашку
      setLatestNotification(null);
    }
  }, [unreadNotifications, notifications]);

  const handlePagerClick = () => {
    unlockPagerAudio();
    setIsExpanded(!isExpanded);
  };

  const handleNotificationClick = (notification) => {
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    setIsExpanded(false);
    // После клика уведомление будет помечено как прочитанное,
    // и плашка автоматически скроется благодаря useEffect
  };

  const handleDismiss = (e, notificationId) => {
    e.stopPropagation();
    if (onDismiss) {
      onDismiss(notificationId);
    }
  };

  if (unreadNotifications.length === 0 && !latestNotification) {
    return null;
  }

  return (
    <div className={styles.pagerNotificationContainer}>
      <div 
        className={`${styles.pagerWrapper} ${isExpanded ? styles.expanded : ''}`}
        onClick={handlePagerClick}
      >
        <div className={styles.pagerIconWrapper}>
          <div className={styles.pagerIcon}>
            <Radio size={22} />
          </div>
          {unreadCount > 0 && (
            <div className={styles.unreadBadge}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </div>
        
        {latestNotification && !isExpanded && (
          <div className={styles.notificationPreview}>
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
            {unreadNotifications.length === 0 ? (
              <div className={styles.emptyState}>
                <Bell size={24} />
                <p>Нет уведомлений</p>
              </div>
            ) : (
              unreadNotifications.map((notification) => (
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

