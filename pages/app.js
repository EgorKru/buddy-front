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
        setInputError(err?.message || 'Failed to create room');
      }
    },
    [createRoom, router]
  );

  const joinRoom = useCallback(() => {
    const trimmedRoomId = roomId.trim().toUpperCase();
    setInputError('');

    if (!trimmedRoomId) {
      setInputError('Enter a room ID');
      roomInputRef.current?.focus();
      return;
    }

    if (!ROOM_ID_REGEX.test(trimmedRoomId)) {
      setInputError('Room ID: 6–12 letters or digits (A–Z, 0–9)');
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
    return <Loader fullPage text="Loading..." />;
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
          <h2 className={shellStyles.panelTitle}>Start a voice room</h2>
          <p className={shellStyles.panelHint}>
            Create a room and share the link with your team, or join an existing one.
          </p>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className={shellStyles.createBtn}
            disabled={isCreating}
          >
            <Plus size={20} />
            Create new room
          </button>
        </div>

        <div className={shellStyles.divider}>or</div>

        <div className={shellStyles.panel}>
          <h2 className={shellStyles.panelTitle}>Join existing room</h2>
          <div className={shellStyles.joinRow}>
            <div className={shellStyles.inputWrap}>
              <Lock size={18} className={shellStyles.inputIcon} aria-hidden />
              <input
                ref={roomInputRef}
                id="room-id"
                name="roomId"
                type="text"
                placeholder="Paste room ID"
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
              Join room
            </button>
          </div>
        </div>
      </AppShell>

      <MediaPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleCreateRoom}
        title="Before you join"
        confirmText="Create room"
        isCreating={isCreating}
      />
    </>
  );
}
