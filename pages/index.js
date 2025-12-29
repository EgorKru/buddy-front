import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/router'
import { useEffect } from 'react';

import styles from '@/styles/home.module.css'
import { useState } from 'react';
import { isAuthenticated, getCurrentUser, authAPI } from '@/utils/api';
import PagerNotification from '@/component/PagerNotification';
import { useNotifications } from '@/hooks/useNotifications';

export default function Home() {
  const router = useRouter()
  const [roomId, setRoomId] = useState('')
  const [user, setUser] = useState(null)
  const { notifications, markAsRead, dismissNotification } = useNotifications();

  useEffect(() => {
    const checkAuth = () => {
      if (!isAuthenticated()) {
        router.push('/login');
        return;
      }
      const currentUser = getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Если есть токен, но нет пользователя, всё равно редиректим на логин
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  const createAndJoin = () => {
    const roomId = uuidv4()
    router.push(`/${roomId}`)
  }

  const joinRoom = () => {
    const trimmedRoomId = roomId.trim();
    if (trimmedRoomId) {
      router.push(`/${trimmedRoomId}`)
    } else {
      alert("Пожалуйста, введите корректный ID комнаты")
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      joinRoom();
    }
  }

  const handleLogout = () => {
    authAPI.logout();
    router.push('/login');
  };

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgb(18, 18, 20)',
        color: 'rgb(255, 255, 255)',
        fontSize: '18px',
        fontWeight: '500'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgb(50, 50, 60)',
            borderTopColor: 'rgb(102, 126, 234)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <style jsx>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <span>Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.homeContainer}>
      <div className={styles.header}>
        <h1>Pager</h1>
        <div className={styles.userInfo}>
          <span>Привет, {user.displayName || user.username}!</span>
          <button onClick={() => router.push('/chat/1')} className={styles.chatButton}>
            Чаты
          </button>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Выйти
          </button>
        </div>
      </div>
      
      <div className={styles.mainContent}>
        <div className={styles.enterRoom}>
          <input 
            placeholder='Введите ID комнаты' 
            value={roomId} 
            onChange={(e) => setRoomId(e?.target?.value)}
            onKeyPress={handleKeyPress}
          />
          <button onClick={joinRoom}>Войти в комнату</button>
        </div>
        <span className={styles.separatorText}>ИЛИ</span>
        <button onClick={createAndJoin} className={styles.createButton}>
          Создать новую комнату
        </button>
      </div>
      
      <PagerNotification
        notifications={notifications}
        onNotificationClick={(notification) => {
          markAsRead(notification.id);
          // Можно добавить навигацию к чату или другому действию
          if (notification.chatId) {
            router.push(`/chat/${notification.chatId}`);
          }
        }}
        onDismiss={dismissNotification}
      />
    </div>
  )
}
