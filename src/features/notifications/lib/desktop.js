import { isDesktopNotificationsEnabled } from '@/features/preferences';

export function showDesktopNotification(notification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (!isDesktopNotificationsEnabled() || window.Notification.permission !== 'granted') {
    return null;
  }

  try {
    const desktopNotification = new window.Notification(
      notification?.title || 'Новое сообщение в Pager',
      {
        body: notification?.content || 'Откройте Pager, чтобы посмотреть сообщение',
        icon: '/favicon.ico',
        tag: notification?.id ? `pager-notification-${notification.id}` : 'pager-notification',
      }
    );
    desktopNotification.onclick = () => {
      window.focus();
      desktopNotification.close();
    };
    return desktopNotification;
  } catch {
    return null;
  }
}
