import { useState, useEffect, useRef } from 'react';
import { useStomp } from '@/context/socket';
import { notificationAPI } from '@/utils/api';

/**
 * Хук для работы с уведомлениями
 * Получает уведомления из WebSocket и API
 */
export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { client, connected } = useStomp();
  const subscriptionsRef = useRef([]);

  useEffect(() => {
    // Загружаем уведомления при монтировании
    loadNotifications();
  }, []);

  useEffect(() => {
    if (!client || !connected || !client.connected || !client.active) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ useNotifications: Не могу подписаться, нет подключения:', {
          hasClient: !!client,
          connected,
          clientConnected: client?.connected,
          clientActive: client?.active
        });
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('📡 useNotifications: Подписываемся на уведомления');
    }
    
    // Небольшая задержка для гарантии, что соединение полностью установлено
    const timeout = setTimeout(() => {

    // Отписываемся от старых подписок
    subscriptionsRef.current.forEach(sub => {
      try {
        sub.unsubscribe();
      } catch (error) {
        console.error('Ошибка отписки от старой подписки уведомлений:', error);
      }
    });
    subscriptionsRef.current = [];

    // Подписываемся на общие уведомления через WebSocket
    const notificationsSubscription = client.subscribe('/user/queue/notifications', (message) => {
        try {
          const notification = JSON.parse(message.body);
          if (process.env.NODE_ENV === 'development') {
            console.log('Получено уведомление:', notification);
          }
          addNotification(notification);
        } catch (error) {
          console.error('Ошибка парсинга уведомления:', error);
        }
      });

      // Подписываемся на уведомления о новых сообщениях
      const messagesSubscription = client.subscribe('/user/queue/messages', (message) => {
        try {
          const notification = JSON.parse(message.body);
          if (process.env.NODE_ENV === 'development') {
            console.log('Получено уведомление о сообщении:', notification);
          }
          // Бэкенд уже отправляет уведомление в формате NotificationDto
          addNotification(notification);
        } catch (error) {
          console.error('Ошибка обработки уведомления о сообщении:', error);
        }
      });

      subscriptionsRef.current = [notificationsSubscription, messagesSubscription];

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ useNotifications: Успешно подписались на уведомления:', {
          notificationsId: notificationsSubscription.id,
          messagesId: messagesSubscription.id
        });
      }

      return () => {
        clearTimeout(timeout);
        if (process.env.NODE_ENV === 'development') {
          console.log('🔌 useNotifications: Отписываемся от уведомлений');
        }
        subscriptionsRef.current.forEach(sub => {
          try {
            sub.unsubscribe();
          } catch (error) {
            console.error('Ошибка отписки от уведомлений:', error);
          }
        });
        subscriptionsRef.current = [];
      };
    }, 100);
    
    return () => {
      clearTimeout(timeout);
      subscriptionsRef.current.forEach(sub => {
        try {
          sub.unsubscribe();
        } catch (error) {
          console.error('Ошибка отписки от уведомлений:', error);
        }
      });
      subscriptionsRef.current = [];
    };
  }, [client, connected]);

  /**
   * Загрузка уведомлений с сервера
   */
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationAPI.getNotifications(0, 50);
      // Бэкенд возвращает объект с полями content (массив) и метаданными пагинации
      const notificationsList = data.content || data || [];
      // Сортируем по дате создания (новые первыми)
      const sorted = notificationsList.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      setNotifications(sorted);
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
      // В случае ошибки оставляем пустой массив
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Добавление нового уведомления
   */
  const addNotification = (notification) => {
    setNotifications(prev => {
      // Проверяем, нет ли уже такого уведомления
      const exists = prev.find(n => n.id === notification.id);
      if (exists) {
        // Обновляем существующее уведомление
        return prev.map(n => n.id === notification.id ? notification : n);
      }
      // Добавляем новое уведомление в начало списка
      return [notification, ...prev];
    });
  };

  /**
   * Отметить уведомление как прочитанное
   */
  const markAsRead = async (notificationId) => {
    // Оптимистичное обновление UI
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    
    try {
      await notificationAPI.markAsRead(notificationId);
    } catch (error) {
      console.error('Ошибка отметки уведомления как прочитанного:', error);
      // Откатываем изменение в случае ошибки
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: false } : n
        )
      );
    }
  };

  /**
   * Удалить уведомление
   */
  const dismissNotification = async (notificationId) => {
    // Сохраняем уведомление для возможного отката
    const notificationToRemove = notifications.find(n => n.id === notificationId);
    
    // Оптимистичное обновление UI
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    try {
      await notificationAPI.deleteNotification(notificationId);
    } catch (error) {
      console.error('Ошибка удаления уведомления:', error);
      // Откатываем изменение в случае ошибки
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

