import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Hash,
  ArrowRight,
  Plus,
  AlertCircle,
  Video,
  MessageCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
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

  const handleLogout = useCallback(async () => {
    await logout().catch(() => {});
    await router.push('/login');
  }, [logout, router]);

  const displayError = inputError || createError;
  const displayName = user?.displayName || user?.username || 'Пользователь';
  const firstName = displayName.trim().split(/\s+/)[0];

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
        <section className={shellStyles.dashboard} aria-labelledby="workspace-title">
          <div className={shellStyles.workspaceIntro}>
            <span className={shellStyles.eyebrow}>Рабочее пространство</span>
            <h1 id="workspace-title">{firstName}, команда уже рядом.</h1>
            <p>
              Начните встречу, вернитесь в чат или подключитесь по коду — основные действия всегда
              на расстоянии одного клика.
            </p>
            <div className={shellStyles.capabilities} aria-label="Возможности Pager">
              <span>
                <Zap size={15} aria-hidden /> Мгновенное подключение
              </span>
              <span>
                <ShieldCheck size={15} aria-hidden /> Защищённая связь
              </span>
            </div>
          </div>

          <div className={shellStyles.actionGrid}>
            <article className={`${shellStyles.actionCard} ${shellStyles.meetingCard}`}>
              <div className={shellStyles.cardIcon} aria-hidden>
                <Video size={24} />
              </div>
              <div className={shellStyles.cardCopy}>
                <span className={shellStyles.cardKicker}>Новая встреча</span>
                <h2>Соберите команду сейчас</h2>
                <p>Проверьте камеру и микрофон, затем поделитесь одной ссылкой.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className={shellStyles.createBtn}
                disabled={isCreating}
              >
                <Plus size={19} aria-hidden />
                Создать комнату
              </button>
            </article>

            <article className={`${shellStyles.actionCard} ${shellStyles.joinCard}`}>
              <div className={shellStyles.cardIconSecondary} aria-hidden>
                <Hash size={23} />
              </div>
              <div className={shellStyles.cardCopy}>
                <span className={shellStyles.cardKicker}>Есть приглашение?</span>
                <h2>Войти по коду</h2>
                <p>Вставьте ID комнаты — регистр и пробелы исправим автоматически.</p>
              </div>
              <div className={shellStyles.joinRow}>
                <div className={shellStyles.inputWrap}>
                  <Hash size={18} className={shellStyles.inputIcon} aria-hidden />
                  <input
                    ref={roomInputRef}
                    id="room-id"
                    name="roomId"
                    type="text"
                    inputMode="text"
                    placeholder="Например, DESIGN24"
                    value={roomId}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                    className={`${shellStyles.joinInput} ${displayError ? shellStyles.joinInputError : ''}`}
                    aria-invalid={!!displayError}
                    aria-describedby={displayError ? 'room-id-error' : 'room-id-hint'}
                  />
                </div>
                <button
                  type="button"
                  onClick={joinRoom}
                  className={shellStyles.joinBtn}
                  disabled={!roomId.trim() || isCreating}
                  aria-label="Войти в комнату"
                >
                  <ArrowRight size={19} aria-hidden />
                  <span>Войти</span>
                </button>
              </div>
              <span id="room-id-hint" className={shellStyles.inputHint}>
                6–12 латинских букв или цифр
              </span>
              {displayError ? (
                <div id="room-id-error" className={shellStyles.errorMsg} role="alert">
                  <AlertCircle size={16} aria-hidden />
                  <span>{displayError}</span>
                </div>
              ) : null}
            </article>
          </div>

          <div className={shellStyles.contextStrip}>
            <div>
              <MessageCircle size={19} aria-hidden />
              <span>
                <strong>Чаты слева</strong>
                Сообщения, файлы и звонки остаются в одном контексте.
              </span>
            </div>
            <div>
              <Video size={19} aria-hidden />
              <span>
                <strong>Встречи без поиска настроек</strong>
                Камера, звук и экран доступны прямо в панели звонка.
              </span>
            </div>
          </div>
        </section>
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
