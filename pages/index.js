import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/router'
import { useEffect } from 'react';

import styles from '@/styles/home.module.css'
import { useState } from 'react';
import { isAuthenticated, getCurrentUser } from '@/utils/api';

export default function Home() {
  const router = useRouter()
  const [roomId, setRoomId] = useState('')
  const [user, setUser] = useState(null)

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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!user) {
    return <div>Загрузка...</div>;
  }

  return (
    <div className={styles.homeContainer}>
        <div className={styles.header}>
          <h1>MeetDraft</h1>
          <div className={styles.userInfo}>
            <span>Привет, {user.displayName || user.username}!</span>
            <button onClick={() => router.push('/chats')} className={styles.chatButton}>
              Чаты
            </button>
            <button onClick={handleLogout} className={styles.logoutButton}>
              Выйти
            </button>
          </div>
        </div>
        <div className={styles.enterRoom}>
          <input 
            placeholder='Введите ID комнаты' 
            value={roomId} 
            onChange={(e) => setRoomId(e?.target?.value)}
            onKeyPress={handleKeyPress}
          />
          <button onClick={joinRoom}>Войти в комнату</button>
        </div>
        <span className={styles.separatorText}>--------------- ИЛИ ---------------</span>
        <button onClick={createAndJoin}>Создать новую комнату</button>
    </div>
  )
}
