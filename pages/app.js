import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Lock, ArrowRight, Plus, AlertCircle } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useCreateRoom } from '@/features/room/lib/useCreateRoom';
import MediaPreviewModal from '@/features/room/ui/MediaPreviewModal';
import ChatSidebar from '@/widgets/chat-sidebar';
import { AppShell } from '@/surface/app';
import { Loader } from '@/shared/ui/Loader';
import shellStyles from '@/surface/app/appShell.module.css';

const ROOM_ID_REGEX = /^[A-Z0-9]{6,12}$/;

export default function AppHome() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [hasMounted, setHasMounted] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputError, setInputError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const roomInputRef = useRef(null);

  const { createRoom, isCreating, error: createError } = useCreateRoom();

  useEffect(() => {
    setHasMounted(true);
  }, []);

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
        setInputError(err?.message || 'Не удалось создать комнату');
      }
    },
    [createRoom, router]
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
      setInputError('ID комнаты: 6–12 букв или цифр (A–Z, 0–9)');
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

  if (!hasMounted || !user) {
    return <Loader fullPage text="Загрузка…" />;
  }

  return (
    <>
      <ChatSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentChatId={null}
      />

      {sidebarOpen && typeof window !== 'undefined' && window.innerWidth <= 768 ? (
        <div className={shellStyles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
      ) : null}

      <AppShell
        user={user}
        onLogout={handleLogout}
        onMenuClick={() => setSidebarOpen((open) => !open)}
      >
        <div className={shellStyles.panel}>
          <h2 className={shellStyles.panelTitle}>Голосовая комната</h2>
          <p className={shellStyles.panelHint}>
            Создайте комнату и отправьте ссылку команде или присоединитесь к существующей.
          </p>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className={shellStyles.createBtn}
            disabled={isCreating}
          >
            <Plus size={20} />
            Создать комнату
          </button>
        </div>

        <div className={shellStyles.divider}>или</div>

        <div className={shellStyles.panel}>
          <h2 className={shellStyles.panelTitle}>Присоединиться к комнате</h2>
          <div className={shellStyles.joinRow}>
            <div className={shellStyles.inputWrap}>
              <Lock size={18} className={shellStyles.inputIcon} aria-hidden />
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
                className={`${shellStyles.joinInput} ${displayError ? shellStyles.joinInputError : ''}`}
                aria-invalid={!!displayError}
                aria-describedby={displayError ? 'room-id-error' : undefined}
              />
            </div>
            {displayError ? (
              <div id="room-id-error" className={shellStyles.errorMsg} role="alert">
                <AlertCircle size={16} aria-hidden />
                <span>{displayError}</span>
              </div>
            ) : null}
            <button
              type="button"
              onClick={joinRoom}
              className={shellStyles.joinBtn}
              disabled={!roomId.trim() || isCreating}
            >
              <ArrowRight size={18} />
              Войти в комнату
            </button>
          </div>
        </div>
      </AppShell>

      <MediaPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleCreateRoom}
        title="Перед входом"
        confirmText="Создать комнату"
        isCreating={isCreating}
      />
    </>
  );
}
