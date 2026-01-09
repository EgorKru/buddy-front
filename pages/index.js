import { useRouter } from 'next/router'
import { useEffect, useState, useRef } from 'react';

import styles from '@/styles/home.module.css'
import { isAuthenticated, getCurrentUser, authAPI, roomAPI } from '@/utils/api';
import ChatSidebar from '@/component/ChatSidebar';
import MediaPreviewModal from '@/components/room/MediaPreviewModal';

export default function Home() {
  const router = useRouter()
  const [roomId, setRoomId] = useState('')
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [inputError, setInputError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const roomInputRef = useRef(null)

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
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (user && roomInputRef.current) {
      const timer = setTimeout(() => {
        roomInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const openCreatePreview = () => {
    setShowPreview(true);
  };

  const handleCreateRoom = async ({ stream, audioEnabled, videoEnabled }) => {
    setIsCreating(true);
    setInputError('');
    try {
      const newRoom = await roomAPI.createRoom(null, null, 'PUBLIC');
      if (newRoom && newRoom.roomId) {
        const params = new URLSearchParams({
          audio: audioEnabled ? '1' : '0',
          video: videoEnabled ? '1' : '0',
        });
        router.push(`/room/${newRoom.roomId}?${params}`);
      } else {
        throw new Error('Не удалось получить ID комнаты');
      }
    } catch (error) {
      setInputError(error.message || 'Ошибка при создании комнаты');
      setIsCreating(false);
    }
  };

  const joinRoom = () => {
    const trimmedRoomId = roomId.trim().toUpperCase();
    setInputError('');
    
    if (!trimmedRoomId) {
      setInputError('Введите ID комнаты');
      roomInputRef.current?.focus();
      return;
    }

    if (trimmedRoomId.length < 6 || trimmedRoomId.length > 12) {
      setInputError('ID комнаты должен содержать 6-12 символов');
      roomInputRef.current?.focus();
      return;
    }

    router.push(`/room/${trimmedRoomId}`);
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      joinRoom();
    } else {
      setInputError('');
    }
  }

  const handleInputChange = (e) => {
    setRoomId(e.target.value);
    if (inputError) {
      setInputError('');
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
        background: '#ffffff',
        color: '#6b7280',
        fontSize: '16px',
        fontWeight: '400'
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
            border: '4px solid #e5e7eb',
            borderTopColor: '#6b6b6b',
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
      <ChatSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        currentChatId={null}
      />
      
      {sidebarOpen && typeof window !== 'undefined' && window.innerWidth <= 768 && (
        <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
      )}
      
      <div className={styles.mainContent}>
        <div className={styles.header}>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className={styles.menuButton}
            title="Открыть список чатов"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <h1>Pager</h1>
          <div className={styles.userInfo}>
            <span>Привет, {user.displayName || user.username}!</span>
            <button onClick={handleLogout} className={styles.logoutButton}>
              Выйти
            </button>
          </div>
        </div>
        
        <div className={styles.content}>
          <div className={styles.createSection}>
            <button 
              onClick={openCreatePreview} 
              className={styles.createButton}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Создать новую комнату
            </button>
            <p className={styles.createHint}>
              Создайте комнату и поделитесь ссылкой с друзьями
            </p>
          </div>

          <div className={styles.separator}>
            <span>или</span>
          </div>

          <div className={styles.joinSection}>
            <h2 className={styles.sectionTitle}>Войти в существующую комнату</h2>
            <div className={styles.enterRoom}>
              <div className={`${styles.inputWrapper} ${inputError ? styles.inputWrapperError : ''}`}>
                <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <input 
                  ref={roomInputRef}
                  id="room-id"
                  name="roomId"
                  type="text"
                  placeholder="Вставьте ID комнаты" 
                  value={roomId} 
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                />
              </div>
              {inputError && (
                <div className={styles.errorMessage}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  {inputError}
                </div>
              )}
              <button 
                onClick={joinRoom} 
                className={styles.joinButton}
                disabled={!roomId.trim() || isCreating}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10 17 15 12 10 7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                Войти
              </button>
            </div>
          </div>
        </div>
      </div>

      <MediaPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleCreateRoom}
        title="Настройка перед встречей"
        confirmText="Создать встречу"
        isCreating={isCreating}
      />
    </div>
  )
}
