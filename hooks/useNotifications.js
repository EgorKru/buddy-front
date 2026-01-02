import { useState, useEffect, useRef } from 'react';
import { useStomp } from '@/context/socket';
import { isAuthenticated, notificationAPI } from '@/utils/api';
import { safeJsonParse, safeUnsubscribe } from '@/utils/safe';

const SUBSCRIPTION_DELAY = 100;
const DEFAULT_PAGE_SIZE = 50;

const unsubscribeAll = (subscriptions) => {
  subscriptions.forEach(sub => {
    safeUnsubscribe(sub);
  });
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { client, connected } = useStomp();
  const subscriptionsRef = useRef([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    loadNotifications();
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      unsubscribeAll(subscriptionsRef.current);
      subscriptionsRef.current = [];
      return;
    }
    if (!client || !connected || !client.connected || !client.active) {
      return;
    }

    const timeout = setTimeout(() => {
      unsubscribeAll(subscriptionsRef.current);
      subscriptionsRef.current = [];

      const notificationsSubscription = client.subscribe('/user/queue/notifications', (message) => {
        const notification = safeJsonParse(message.body);
        if (!notification) return;
        addNotification(notification);
      });

      subscriptionsRef.current = [notificationsSubscription];

      return () => {
        unsubscribeAll(subscriptionsRef.current);
        subscriptionsRef.current = [];
      };
    }, SUBSCRIPTION_DELAY);

    return () => {
      clearTimeout(timeout);
      unsubscribeAll(subscriptionsRef.current);
      subscriptionsRef.current = [];
    };
  }, [client, connected]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      if (!isAuthenticated()) {
        setNotifications([]);
        return;
      }
      const data = await notificationAPI.getNotifications(0, DEFAULT_PAGE_SIZE);
      const notificationsList = data.content || data || [];
      const sorted = notificationsList.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      setNotifications(sorted);
    } catch (error) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const addNotification = (notification) => {
    setNotifications(prev => {
      const exists = prev.find(n => n.id === notification.id);
      if (exists) {
        return prev.map(n => n.id === notification.id ? notification : n);
      }
      return [notification, ...prev];
    });
  };

  const markAsRead = async (notificationId) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );

    try {
      await notificationAPI.markAsRead(notificationId);
    } catch (error) {
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: false } : n
        )
      );
    }
  };

  const dismissNotification = async (notificationId) => {
    const notificationToRemove = notifications.find(n => n.id === notificationId);

    setNotifications(prev => prev.filter(n => n.id !== notificationId));

    try {
      await notificationAPI.deleteNotification(notificationId);
    } catch (error) {
      if (notificationToRemove) {
        setNotifications(prev => [...prev, notificationToRemove].sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        ));
      }
    }
  };

  return {
    notifications,
    loading,
    markAsRead,
    dismissNotification,
    refreshNotifications: loadNotifications,
    unreadCount: notifications.filter(n => !n.read).length,
  };
};
