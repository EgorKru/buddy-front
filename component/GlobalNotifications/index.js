import { useEffect } from 'react';
import { useRouter } from 'next/router';
import PagerNotification from '@/component/PagerNotification';
import { useNotifications } from '@/hooks/useNotifications';

export default function GlobalNotifications() {
  const router = useRouter();
  const { notifications, markAsRead, dismissNotification } = useNotifications();

  const markChatNotificationsRead = (chatId) => {
    const cid = chatId ? String(chatId) : null;
    if (!cid) return;

    const toMark = notifications.filter(n => {
      const nChatId = n?.chatId ?? n?.message?.chatId;
      return !n.read && nChatId != null && String(nChatId) === cid;
    });

    toMark.forEach(n => {
      if (n?.id) markAsRead(n.id);
    });
  };

  useEffect(() => {
    const match = String(router.asPath || '').match(/^\/chat\/(\d+)/);
    if (match?.[1]) {
      markChatNotificationsRead(match[1]);
    }
  }, [router.asPath, notifications]);

  return (
    <PagerNotification
      notifications={notifications}
      onNotificationClick={(notification) => {
        if (notification?.id) {
          markAsRead(notification.id);
        }

        const chatId = notification?.chatId ?? notification?.message?.chatId;
        if (chatId) {
          router.push(`/chat/${chatId}`);
        }
      }}
      onDismiss={dismissNotification}
    />
  );
}

