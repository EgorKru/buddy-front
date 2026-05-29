import { useEffect, useState, useRef, useCallback } from 'react';
import {
  PhoneOff,
  Video,
  VideoOff,
  Monitor,
  Mic,
  MicOff,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import styles from './index.module.css';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function MinimizedView({
  calleeName,
  isVideo,
  videoEnabled,
  audioEnabled,
  isDragging,
  position,
  minimizedRef,
  styles: s,
  onMouseDown,
  onMinimizedClick,
  onToggleMic,
  onToggleVideo,
  onExpand,
  onCancel,
}) {
  return (
    <div
      className={s.minimizedContainer}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      ref={minimizedRef}
    >
      <div
        className={`${s.minimized} ${isDragging ? s.dragging : ''}`}
        onMouseDown={onMouseDown}
        onClick={onMinimizedClick}
      >
        <div className={s.minimizedAvatar}>{getInitials(calleeName)}</div>
        <div className={s.minimizedInfo}>
          <span className={s.minimizedName}>{calleeName}</span>
          <span className={s.minimizedStatus}>ожидание...</span>
        </div>
        <div className={s.minimizedPulse} />
      </div>
      <div className={s.minimizedControls}>
        <button
          className={`${s.minimizedControlButton} ${!audioEnabled ? s.off : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMic?.();
          }}
          title={audioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
        >
          {audioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
        </button>
        {isVideo && (
          <button
            className={`${s.minimizedControlButton} ${!videoEnabled ? s.off : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleVideo?.();
            }}
            title={videoEnabled ? 'Выключить камеру' : 'Включить камеру'}
          >
            {videoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
          </button>
        )}
        <button
          className={`${s.minimizedControlButton} ${s.expandButton}`}
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          title="Развернуть"
        >
          <Maximize2 size={16} />
        </button>
        <button
          className={`${s.minimizedControlButton} ${s.endCall}`}
          data-testid="outgoing-call-cancel"
          onClick={(e) => {
            e.stopPropagation();
            onCancel?.();
          }}
          title="Завершить звонок"
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  );
}

function FullView({
  calleeName,
  videoEnabled,
  audioEnabled,
  onMinimize,
  onToggleVideo,
  onCancel,
  onToggleMic,
  styles: s,
}) {
  return (
    <div className={s.overlay} data-testid="outgoing-call-modal">
      <div className={s.container}>
        <button className={s.minimizeButton} onClick={onMinimize} title="Свернуть">
          <Minimize2 size={20} />
        </button>
        <div className={s.avatarSection}>
          <div className={s.avatar}>{getInitials(calleeName)}</div>
        </div>
        <div className={s.info}>
          <h2 className={s.calleeName}>{calleeName}</h2>
          <p className={s.status}>ожидание...</p>
        </div>
        <div className={s.controls}>
          <div className={s.controlItem}>
            <button className={s.controlButton} disabled>
              <Monitor size={24} />
            </button>
            <span className={s.controlLabel}>Экран</span>
          </div>
          <div className={s.controlItem}>
            <button
              className={`${s.controlButton} ${!videoEnabled ? s.off : ''}`}
              onClick={onToggleVideo}
            >
              {videoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            <span className={s.controlLabel}>{videoEnabled ? 'Выкл. видео' : 'Вкл. видео'}</span>
          </div>
          <div className={s.controlItem}>
            <button
              className={`${s.controlButton} ${s.endCall}`}
              data-testid="outgoing-call-cancel"
              onClick={onCancel}
            >
              <PhoneOff size={24} />
            </button>
            <span className={s.controlLabel}>Завершить</span>
          </div>
          <div className={s.controlItem}>
            <button
              className={`${s.controlButton} ${!audioEnabled ? s.off : ''}`}
              onClick={onToggleMic}
            >
              {audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <span className={s.controlLabel}>{audioEnabled ? 'Выкл. звук' : 'Вкл. звук'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// complexity: разбит на MinimizedView/FullView
// eslint-disable-next-line complexity
const OutgoingCallModal = ({
  call,
  onCancel,
  onToggleVideo,
  onToggleMic,
  videoEnabled,
  audioEnabled,
  localStream: _localStream,
}) => {
  const [_elapsedTime, setElapsedTime] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({
    x: typeof window !== 'undefined' ? window.innerWidth - 320 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight - 200 : 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const minimizedRef = useRef(null);

  useEffect(() => {
    if (!call) return;
    const interval = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
    return () => {
      clearInterval(interval);
      setElapsedTime(0);
    };
  }, [call]);

  useEffect(() => {
    if (!call) return;
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let oscillators = [];
    let gainNode = null;
    const playSoftMusic = () => {
      try {
        const notes = [261.63, 329.63, 392.0];
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
        notes.forEach((freq, index) => {
          const osc = audioContext.createOscillator();
          osc.connect(gainNode);
          osc.frequency.value = freq;
          osc.type = 'sine';
          osc.start(audioContext.currentTime + index * 0.1);
          osc.stop(audioContext.currentTime + 1.5);
          oscillators.push(osc);
        });
      } catch (_err) {}
    };
    const musicInterval = setInterval(playSoftMusic, 3000);
    playSoftMusic();
    return () => {
      clearInterval(musicInterval);
      oscillators.forEach((osc) => {
        try {
          osc.stop();
        } catch (_e) {}
      });
      if (audioContext.state !== 'closed') audioContext.close().catch(() => {});
    };
  }, [call]);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !isMinimized) return;
      setHasDragged(true);
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 300));
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 150));
      setPosition({ x: newX, y: newY });
    },
    [isDragging, isMinimized, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setTimeout(() => setHasDragged(false), 100);
  }, []);

  useEffect(() => {
    if (isDragging && isMinimized) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isMinimized, handleMouseMove, handleMouseUp]);

  const callee = call?.callee;
  const calleeName =
    callee?.displayName || callee?.username || (callee?.id != null ? `User ${callee.id}` : '?');
  const isVideo = call?.type === 'VIDEO';

  const handleToggleVideo = useCallback(() => {
    onToggleVideo?.();
  }, [onToggleVideo]);

  const handleMouseDown = useCallback(
    (e) => {
      if (!isMinimized) return;
      if (e.target.closest(`.${styles.minimizedControlButton}`)) return;
      setIsDragging(true);
      const rect = minimizedRef.current?.getBoundingClientRect();
      if (rect) setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [isMinimized]
  );

  const handleMinimizedClick = useCallback(
    (e) => {
      if (!hasDragged && !isDragging && !e.target.closest(`.${styles.minimizedControlButton}`)) {
        setIsMinimized(false);
      }
    },
    [hasDragged, isDragging]
  );

  if (!call) return null;

  if (isMinimized) {
    return (
      <MinimizedView
        calleeName={calleeName}
        isVideo={isVideo}
        videoEnabled={videoEnabled}
        audioEnabled={audioEnabled}
        isDragging={isDragging}
        position={position}
        minimizedRef={minimizedRef}
        styles={styles}
        onMouseDown={handleMouseDown}
        onMinimizedClick={handleMinimizedClick}
        onToggleMic={onToggleMic}
        onToggleVideo={handleToggleVideo}
        onExpand={() => setIsMinimized(false)}
        onCancel={onCancel}
      />
    );
  }

  return (
    <FullView
      calleeName={calleeName}
      videoEnabled={videoEnabled}
      audioEnabled={audioEnabled}
      onMinimize={() => setIsMinimized(true)}
      onToggleVideo={handleToggleVideo}
      onCancel={onCancel}
      onToggleMic={onToggleMic}
      styles={styles}
    />
  );
};

OutgoingCallModal.displayName = 'OutgoingCallModal';

export default OutgoingCallModal;
