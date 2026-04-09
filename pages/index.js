import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Menu, Settings, LogOut, Lock, ArrowRight, Plus, AlertCircle } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useCreateRoom } from '@/features/room/lib/useCreateRoom';
import MediaPreviewModal from '@/features/room/ui/MediaPreviewModal';
import ChatSidebar from '@/widgets/chat-sidebar';
import { Loader } from '@/shared/ui/Loader';
import styles from '@/styles/home.module.css';

const ROOM_ID_REGEX = /^[A-Z0-9]{6,12}$/;

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [roomId, setRoomId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputError, setInputError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const roomInputRef = useRef(null);

  const { createRoom, isCreating, error: createError } = useCreateRoom();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (user && roomInputRef.current) {
      const timer = setTimeout(() => roomInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleCreateRoom = useCallback(
    async ({ stream: _stream, audioEnabled, videoEnabled }) => {
      setInputError('');
      try {
        const newRoom = await createRoom({ audioEnabled, videoEnabled });
        const params = new URLSearchParams({
          audio: audioEnabled ? '1' : '0',
          video: videoEnabled ? '1' : '0',
        });
        router.push(`/room/${newRoom.roomId}?${params}`);
      } catch (err) {
        setInputError(err?.message || 'Ошибка при создании комнаты');
      }
    },
    [createRoom, createError]
  );

  const joinRoom = useCallback(() => {
    const trimmedRoomId = roomId.trim().toUpperCase();
    setInputError('');

    if (!trimmedRoomId) {
      setInputError('Введите ID комнаты');
      roomInputRef.current?.focus();
      return;
    }

    if (!ROOM_ID_REGEX.test(trimmedRoomId)) {
      setInputError('ID комнаты: 6–12 букв или цифр (латиница)');
      roomInputRef.current?.focus();
      return;
    }

    router.push(`/room/${trimmedRoomId}`);
  }, [roomId, router]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') joinRoom();
      else setInputError('');
    },
    [joinRoom]
  );

  const handleInputChange = useCallback((e) => {
    setRoomId(e.target.value);
    setInputError('');
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    router.push('/login');
  }, [logout, router]);

  const displayError = inputError || createError;

  if (!user) {
    return <Loader fullPage text="Загрузка..." />;
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
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={styles.menuButton}
            title="Открыть список чатов"
            aria-label="Открыть список чатов"
          >
            <Menu size={20} />
          </button>
          <h1>Pager</h1>
          <div className={styles.userInfo}>
            <span>Привет, {user.displayName || user.username}!</span>
            <Link href="/settings" className={styles.settingsButton} aria-label="Настройки">
              <Settings size={18} />
              Настройки
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className={styles.logoutButton}
              aria-label="Выйти из аккаунта"
            >
              <LogOut size={18} />
              Выйти
            </button>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.createSection}>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className={styles.createButton}
              disabled={isCreating}
            >
              <Plus size={20} />
              Создать новую комнату
            </button>
            <p className={styles.createHint}>Создайте комнату и поделитесь ссылкой с друзьями</p>
          </div>

          <div className={styles.separator}>
            <span>или</span>
          </div>

          <div className={styles.joinSection}>
            <h2 className={styles.sectionTitle}>Войти в существующую комнату</h2>
            <div className={styles.enterRoom}>
              <div
                className={`${styles.inputWrapper} ${displayError ? styles.inputWrapperError : ''}`}
              >
                <Lock size={18} className={styles.inputIcon} aria-hidden />
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
                  aria-invalid={!!displayError}
                  aria-describedby={displayError ? 'room-id-error' : undefined}
                />
              </div>
              {displayError && (
                <div id="room-id-error" className={styles.errorMessage} role="alert">
                  <AlertCircle size={16} aria-hidden />
                  <span>{displayError}</span>
                </div>
              )}
              <button
                type="button"
                onClick={joinRoom}
                className={styles.joinButton}
                disabled={!roomId.trim() || isCreating}
                title={!roomId.trim() && !isCreating ? 'Сначала введите ID комнаты' : undefined}
              >
                <ArrowRight size={18} />
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
  );
}
