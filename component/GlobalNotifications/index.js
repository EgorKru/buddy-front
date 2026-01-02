import { useRouter } from 'next/router';
import PagerNotification from '@/component/PagerNotification';
import { useNotifications } from '@/hooks/useNotifications';

export default function GlobalNotifications() {
  const router = useRouter();
  const { notifications, markAsRead, dismissNotification } = useNotifications();

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


